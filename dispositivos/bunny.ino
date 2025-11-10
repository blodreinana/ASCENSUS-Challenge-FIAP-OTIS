// --- Bibliotecas ---
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <esp_now.h>

const char* ssid = "REDMAGIC 10 Air";      
const char* password = "653664980390";     
uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// --- Estrutura de Dados  ---
typedef struct struct_message_buddy {
    float tempC;
    float currentA;
    int noiseLevel;
} struct_message_buddy;

struct_message_buddy dadosBuddy;

// Pino para o sensor de temperatura DS18B20 
#define DS18B20_PIN 4
// Pinos para os sensores analógicos 
#define ACS712_PIN  2  // ADC1_CH2
#define MAX9814_PIN 3  // ADC1_CH3

const unsigned long intervaloAcao = 5000;
unsigned long previousMillis = 0;

// Máquina de Estados para o fluxo
enum Estado { LER_E_ENVIAR, ESPERAR };
Estado estadoAtual = LER_E_ENVIAR;

// --- Objetos dos Sensores ---
OneWire oneWire(DS18B20_PIN);
DallasTemperature sensors(&oneWire);

// --- Variáveis de Calibração (ACS712) ---
int acsOffset = 2048;
const float acsSensitivity = 8.058; 

void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  Serial.print("\nStatus do Envio: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "Sucesso" : "Falha no Envio");
}


void setup() {
  Serial.begin(115200);
  while (!Serial); 

  Serial.println("--- Módulo Buddy (Motor) Iniciado ---");

  // 1. Inicia o Wi-Fi em modo Estação
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Conectando ao Wi-Fi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConectado!");
  Serial.print("Canal Wi-Fi: ");
  Serial.println(WiFi.channel());

  // 2. Inicia o ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Erro ao inicializar ESP-NOW");
    return;
  }
  Serial.println("ESP-NOW Iniciado.");

  // 3. Registra o Callback de Envio
  esp_now_register_send_cb(OnDataSent);

  // 4. Adiciona o "Peer" (Bunny)
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, broadcastAddress, 6);
  peerInfo.channel = 0;  // 0 significa canal atual
  peerInfo.encrypt = false;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK){
    Serial.println("Falha ao adicionar peer (Bunny)");
    return;
  }
  Serial.println("Peer (Bunny) adicionado via Broadcast.");

  // --- Setup dos Sensores (código original) ---
  sensors.begin();
  Serial.println("Sensor DS18B20 iniciado.");

  pinMode(ACS712_PIN, INPUT);
  pinMode(MAX9814_PIN, INPUT);
  
  Serial.println("Calibrando ACS712... Aguarde 2 segundos.");
  long total = 0;
  for (int i = 0; i < 100; i++) {
    total += analogRead(ACS712_PIN);
    delay(20);
  }
  acsOffset = total / 100;
  Serial.print("Calibração ACS712 completa. Offset ADC: ");
  Serial.println(acsOffset);
  
  Serial.println("Iniciando ciclo de leitura e envio...");
  
  // Define o início do ciclo (começa 5s "atrasado" para a primeira ação ser em T=5s)
  previousMillis = millis();
}

// --- Nova Função: Ler Sensores ---
void lerSensoresBuddy() {
  Serial.println("\n[T=Leitura] Lendo sensores do Buddy...");
  
  // 1. Leitura do DS18B20
  sensors.requestTemperatures(); 
  dadosBuddy.tempC = sensors.getTempCByIndex(0);
  if (dadosBuddy.tempC == DEVICE_DISCONNECTED_C) {
    Serial.println("Erro: DS18B20 desconectado.");
    dadosBuddy.tempC = -127; // Valor de erro
  }

  // 2. Leitura do ACS712
  int sensorValue = analogRead(ACS712_PIN);
  dadosBuddy.currentA = (sensorValue - acsOffset) / acsSensitivity;
  
  // 3. Leitura do MAX9814
  dadosBuddy.noiseLevel = analogRead(MAX9814_PIN);
}

// --- Nova Função: Enviar Dados via ESP-NOW ---
void enviarDados() {
  Serial.println("[T=Envio] Enviando dados para a Bunny...");
  esp_err_t result = esp_now_send(broadcastAddress, (uint8_t *) &dadosBuddy, sizeof(dadosBuddy));
  
  // O resultado real virá no callback OnDataSent
}

void loop() {
  unsigned long currentMillis = millis();

  // O loop agora é controlado pela máquina de estados e pelo intervalo
  if (currentMillis - previousMillis >= intervaloAcao) {
    previousMillis = currentMillis;

    if (estadoAtual == LER_E_ENVIAR) {
      // --- Ciclo 1 (Ex: T=5s, T=15s, T=25s) ---
      lerSensoresBuddy();
      enviarDados();
      estadoAtual = ESPERAR; // Muda para o próximo estado
      
    } else if (estadoAtual == ESPERAR) {
      // --- Ciclo 2 (Ex: T=10s, T=20s, T=30s) ---
      Serial.println("\n[T=Espera] Aguardando 5s para proxima leitura/envio.");
      estadoAtual = LER_E_ENVIAR; // Muda de volta para o primeiro estado
    }
  }
}