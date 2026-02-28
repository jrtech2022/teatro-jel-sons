# Sistema de Disparo de Áudio Teatral - O Juízo Final

Este projeto foi desenvolvido para ser um console de áudio profissional para a peça "O Juízo Final".

## 🎵 Estrutura de Trilhas

1. **Trilha Sonora + Narração** (`Trilha Sonora.mp3`): Música base com narração integrada.
2. **Fundo Musical (Declamação)** (`Fundo Musical.mp3`): Tocado ao término da apresentação para leitura de uma declamação.
3. **Playback (Apocalipse - Damares)** (`Playback.mp3`): Hino final após a declamação.

## 🚀 Como Rodar Localmente

1. **Pré-requisitos**: Tenha o [Node.js](https://nodejs.org/) instalado.
2. **Extraia os arquivos**: Coloque todos os arquivos do projeto em uma pasta.
3. **Instale as dependências**:
   ```bash
   npm install
   ```
4. **Adicione seus áudios**:
   Coloque os arquivos abaixo na pasta `public/audio/`:
   - `Trilha Sonora.mp3`
   - `Fundo Musical.mp3`
   - `Playback.mp3`
5. **Inicie o sistema**:
   ```bash
   npm run dev
   ```
6. **Acesse**: Abra o navegador em `http://localhost:3000`.

## 🎛 Funcionamento dos Fades
- **Fade-out**: Ao trocar de trilha (ex: iniciar a 2 enquanto a 1 toca), a trilha anterior fará um fade-out suave de 3 segundos.
- **Sem Fade-in**: As trilhas iniciam instantaneamente no volume máximo definido, sem rampa de subida.

## 📱 Uso no Celular
Para usar no celular, certifique-se de que o computador e o celular estão na mesma rede Wi-Fi e acesse o IP do computador na porta 3000.
