// --- Bibliotecas ---
#include <Wire.h>
#include "VL53L0X.h"
#include "I2Cdev.h"
#include "MPU6050.h"
#include <WiFi.h>
#include <esp_now.h>

// --- Configuração da Rede ---
const char* ssid = "REDMAGIC 10 Air";      // <<<<<< ALTERE AQUI
const char* password = "653664980390";     // <<<<<< ALTERE AQUI

// --- Estrutura de Dados (DEVE SER IDÊNTICA NO BUDDY) ---
typedef struct struct_message_buddy {
    float tempC;
    float currentA;
    int noiseLevel;
} struct_message_buddy;

// Cria uma instância para guardar os dados recebidos
struct_message_buddy dadosRecebidosDoBuddy;
// Flag para sinalizar que novos dados chegaram
volatile bool novosDadosRecebidos = false;

// --- Variáveis Globais para os sensores da Bunny ---
int16_t ax, ay, az;
int16_t gx, gy, gz;
uint16_t distanciasVLX[4];
bool vibracaoDetectada = false;
int vibracaoDeteccoes = 0; // Armazena a contagem de detecções

// --- Constantes e Pinos ---
#define SDA_PIN 8
#define SCL_PIN 9
#define SW420_PIN 10

// --- Configuração do Multiplexador I2C ---
#define MUX_ADDRESS 0x70
#define VL53L0X_CH_0 0
#define VL53L0X_CH_1 1
#define VL53L0X_CH_2 2
#define VL53L0X_CH_3 3
#define MPU6050_CHANNEL 4
#define NUM_VL53L0X 4

// --- Variáveis de Tempo ---
// Intervalo de CADA AÇÃO (leitura ou impressão)
const unsigned long intervaloAcao = 5000; // 5 segundos (Variável solicitada)
unsigned long previousMillis = 0;

// Máquina de Estados para o fluxo
enum Estado { LER_SENSORES, IMPRIMIR_DADOS };
Estado estadoAtual = LER_SENSORES;

// --- Objetos dos Sensores ---
VL53L0X sensorVLX[NUM_VL53L0X];
MPU6050 mpu;

// --- Função Callback: Chamada quando os dados são Recebidos ---
void OnDataRecv(const esp_now_recv_info_t * info, const uint8_t *incomingData, int len) {
  if (len == sizeof(dadosRecebidosDoBuddy)) {
    memcpy(&dadosRecebidosDoBuddy, incomingData, sizeof(dadosRecebidosDoBuddy));
    novosDadosRecebidos = true;
    Serial.println("\n[T=Recebimento] Pacote de dados recebido do Buddy!");
  } else {
    Serial.println("\n[T=Recebimento] Recebido pacote com tamanho incompatível.");
  }
}

// --- Função Helper do Multiplexador ---
void tcaSelect(uint8_t i) {
  if (i > 7) return;
  Wire.beginTransmission(MUX_ADDRESS);
  Wire.write(1 << i);
  Wire.endTransmission();
}

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("--- Módulo Bunny (Cabine) Iniciado ---");

  // 1. Inicia o Wi-Fi em modo Estação
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Conectando ao Wi-Fi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConectado!");
  Serial.print("Meu Endereco MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.print("Canal Wi-Fi: ");
  Serial.println(WiFi.channel());

  // 2. Inicia o ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Erro ao inicializar ESP-NOW");
    return;
  }
  Serial.println("ESP-NOW Iniciado.");

  // 3. Registra o Callback de Recebimento
  esp_now_register_recv_cb(OnDataRecv);
  
  // --- Setup dos Sensores ---
  Wire.begin(SDA_PIN, SCL_PIN);
  pinMode(SW420_PIN, INPUT);

  Serial.println("Procurando dispositivos I2C...");

  // Inicializa o MPU-6050
  Serial.print("Iniciando MPU-6050 no canal ");
  Serial.println(MPU6050_CHANNEL);
  tcaSelect(MPU6050_CHANNEL);
  mpu.initialize();
  if (mpu.testConnection()) {
    Serial.println("MPU-6050 iniciado com sucesso.");
  } else {
    Serial.println("Erro ao iniciar MPU-6050.");
  }

  // Inicializa os 4 sensores VL53L0X
  for (int i = 0; i < NUM_VL53L0X; i++) {
    Serial.print("Iniciando VL53L0X no canal ");
    Serial.print(i);
    tcaSelect(i);
    if (sensorVLX[i].init()) {
      Serial.println("... OK");
      sensorVLX[i].setTimeout(500);
      sensorVLX[i].startContinuous();
    } else {
      Serial.println("... ERRO");
    }
  }
  
  Serial.println("Iniciando ciclo de leitura e impressao...");
  
  // Define o início do ciclo (começa 5s "atrasado" para a primeira ação ser em T=5s)
  previousMillis = millis();
}

// --- Nova Função: Ler Sensores da Bunny ---
void lerSensoresBunny() {
  Serial.println("\n[T=Leitura] Lendo sensores da Bunny...");
  
  // --- 1. Leitura do MPU-6050 ---
  tcaSelect(MPU6050_CHANNEL);
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

  // --- 2. Leitura dos sensores VL53L0X ---
  for (int i = 0; i < NUM_VL53L0X; i++) {
    tcaSelect(i);
    distanciasVLX[i] = sensorVLX[i].readRangeContinuousMillimeters();
    if (sensorVLX[i].timeoutOccurred()) { 
      distanciasVLX[i] = 8190; // Indica erro/timeout
    }
  }

  // --- 3. Leitura do Sensor de Vibração (SW-420) ---
  // Lógica de FILTRO DE TOLERÂNCIA (debounce/filtragem de ruído)
  // Faz N amostras em X milissegundos para filtrar ruídos.
  
  int detectionCount = 0;
  int sampleWindow = 200; // Janela de tempo para amostragem (ms)
  int numSamples = 100;   // Número de amostras
  // Tolerância: % de amostras que precisam detectar vibração
  int toleranceThresholdPercent = 5; // 5% 

  for (int i = 0; i < numSamples; i++) {
    // O digitalRead da o pino DO que vai a ALTA (HIGH) em vibração.
    if (digitalRead(SW420_PIN) == HIGH) { // Lógica invertida corrigida
      detectionCount++;
    }
    delay(sampleWindow / numSamples); // delays(ms)
  }
  
  vibracaoDeteccoes = detectionCount; // Salva a contagem
  
  // Só reporta "DETECTADA" se a contagem passar da nossa tolerância
  if (detectionCount > (numSamples * toleranceThresholdPercent / 100)) { 
    vibracaoDetectada = true;
  } else {
    vibracaoDetectada = false;
  }
}

// --- Nova Função: Imprimir TODOS os dados ---
void imprimirTodosOsDados() {
  Serial.println("\n========================================");
  Serial.println("       RELATORIO DE STATUS (OTIS)");
  Serial.println("========================================");
  
  unsigned long timestamp = millis();
  Serial.print("Timestamp: ");
  Serial.println(timestamp);
  
  Serial.println("\n--- DADOS DA BUNNY (Cabine) ---");
  
  // Imprime dados MPU
  Serial.print("  Acel. (X,Y,Z): ");
  Serial.print(ax); Serial.print(", ");
  Serial.print(ay); Serial.print(", ");
  Serial.println(az);
  Serial.print("  Giro (X,Y,Z):  ");
  Serial.print(gx); Serial.print(", ");
  Serial.print(gy); Serial.print(", ");
  Serial.println(gz);
  
  // Imprime dados VL53L0X
  for (int i = 0; i < NUM_VL53L0X; i++) {
    Serial.print("  Dist. (Canal "); Serial.print(i); Serial.print("): ");
    if (distanciasVLX[i] >= 8190) {
      Serial.println("Fora de alcance");
    } else {
      Serial.print(distanciasVLX[i]);
      Serial.println(" mm");
    }
  }
  
  // Imprime dados SW-420
  Serial.print("  Vibracao (SW-420):    ");
  if(vibracaoDetectada) {
    Serial.print("DETECTADA! (Contagem: ");
    Serial.print(vibracaoDeteccoes);
    Serial.println(")");
  } else {
    Serial.println("Nenhuma");
  }
  
  Serial.println("\n--- DADOS DO BUDDY (Motor) ---");
  
  if (novosDadosRecebidos) {
    Serial.print("  Temperatura (DS18B20): ");
    if (dadosRecebidosDoBuddy.tempC != -127) {
      Serial.print(dadosRecebidosDoBuddy.tempC);
      Serial.println(" *C");
    } else {
      Serial.println("Erro na leitura do Buddy");
    }
    
    Serial.print("  Corrente (ACS712):    ");
    Serial.print(dadosRecebidosDoBuddy.currentA, 2); // 2 casas decimais
    Serial.println(" A");
    
    Serial.print("  Nivel de Ruido (MAX9814): ");
    Serial.println(dadosRecebidosDoBuddy.noiseLevel);
    
  } else {
    Serial.println("  (Nenhum dado recebido do Buddy nesta rodada)");
  }
  
  Serial.println("========================================");
  Serial.println("         FIM DO RELATORIO");
  Serial.println("========================================");
}


void loop() {
  unsigned long currentMillis = millis();

  // Controla o fluxo de execução a cada 'intervaloAcao'
  if (currentMillis - previousMillis >= intervaloAcao) {
    previousMillis = currentMillis;

    if (estadoAtual == LER_SENSORES) {
      // --- Ciclo 1 (Ex: T=5s, T=15s, T=25s) ---
      // A Bunny lê seus próprios sensores
      lerSensoresBunny();
      Serial.println("[T=Leitura] Sensores locais da Bunny lidos.");
      Serial.println("[T=Leitura] Aguardando 5s para impressao...");
      
      // Muda para o próximo estado
      estadoAtual = IMPRIMIR_DADOS;
      
    } else if (estadoAtual == IMPRIMIR_DADOS) {
      // --- Ciclo 2 (Ex: T=10s, T=20s, T=30s) ---
      // A Bunny imprime o relatório completo
      imprimirTodosOsDados();
      
      // Reseta a flag de dados para o próximo ciclo
      novosDadosRecebidos = false; 
      
      // Muda de volta para o primeiro estado
      estadoAtual = LER_SENSORES; 
    }
  }
}