# HCC Med Pay Flow

Sistema de gestão de pagamentos médicos com integração WhatsApp e portal para médicos.

**Criado por Conquista Inovação**

## Descrição

Sistema completo para gerenciamento de notas fiscais e pagamentos de médicos, com notificações automáticas via WhatsApp e email, portal de acesso para médicos e dashboard administrativo.

## Tecnologias

- React + TypeScript + Vite
- Supabase (Backend, Auth, Storage)
- Tailwind CSS
- Edge Functions

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Deploy

Execute os scripts na pasta `deploy-vps/` para fazer deploy em VPS Ubuntu:

```bash
./deploy-vps/install.sh
./deploy-vps/validate-deployment.sh
```

## Domínio

- **Produção**: https://hcc.chatconquista.com
