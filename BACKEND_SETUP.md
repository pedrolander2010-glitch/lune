# LUNE — Guia de Configuração do Backend Remoto (Supabase)

Este documento descreve os passos exatos para configurar a infraestrutura de backend em nuvem do **LUNE** utilizando **Supabase (PostgreSQL + Auth + Realtime + Storage)**.

---

## 1. Por Que o Supabase é Necessário?

Na versão anterior, o LUNE utilizava um servidor local Node.js (`server.ts`) com SQLite (`lune.db`). 
Ao ser publicado no **GitHub Pages** (hospedagem puramente estática para Single-Page Applications):
- O GitHub Pages **não executa** servidores Node.js, WebSockets locais ou bancos SQLite.
- Usuários criados em um computador ficavam restritos ao banco daquela máquina.
- Usuários em celulares ou computadores distintos não conseguiam se descobrir nem trocar mensagens.

Com o **Supabase**, a nuvem do PostgreSQL atua como a **única fonte da verdade**. Dois usuários em qualquer navegador, conexão de internet ou dispositivo físico compartilham contas, amizades, mensagens e chamadas em tempo real.

---

## 2. Passo a Passo de Configuração no Supabase

### Passo 1: Criar o Projeto no Supabase
1. Acesse [https://supabase.com](https://supabase.com) e entre na sua conta (ou crie uma gratuitamente).
2. Clique em **"New Project"**.
3. Escolha uma organização, defina um nome (ex: `lune-production`) e uma senha forte para o banco de dados.
4. Selecione uma região geográfica próxima (ex: `sa-east-1` São Paulo ou `us-east-1`).
5. Clique em **"Create new project"** e aguarde cerca de 1 a 2 minutos até o provisionamento concluir.

---

### Passo 2: Executar as Migrações do Banco de Dados
1. No painel do seu projeto no Supabase, acesse o menu lateral esquerdo e clique em **SQL Editor**.
2. Clique em **"New Query"**.
3. Abra o arquivo localizado neste repositório em:
   `supabase/migrations/20260904000000_lune_init.sql`
4. Copie todo o conteúdo do arquivo e cole no editor SQL do Supabase.
5. Clique no botão verde **"Run"** (ou pressione `Ctrl+Enter`).
6. Verifique se a saída indica `Success. No rows returned` (todas as tabelas, índices, RLS e funções foram criados).

**Tabelas Criadas:**
- `profiles`: Contas públicas vinculadas ao `auth.users(id)`, com `@username` normalizado em caixa baixa único, nome de exibição e cooldown de 7 dias para alteração.
- `friend_requests`: Solicitações de amizade (`pending`, `accepted`, `declined`, `cancelled`) com prevenção de duplicatas e auto-solicitações.
- `friendships`: Pares canônicos de amigos (`user_low < user_high`) com unicidade estrita.
- `blocks`: Bloqueios entre usuários.
- `conversations`: Salas de conversa Direta (DM) e Grupos.
- `conversation_members`: Membros participantes de cada conversa.
- `messages`: Histórico persistente de mensagens, anexos e reações com ordenação indexada.
- `user_saved_gifs`: Favoritos do sistema Global GIF persistidos em nuvem.

---

### Passo 3: Configurar a Autenticação (Supabase Auth)
1. No menu lateral do Supabase, clique em **Authentication** e depois em **Providers**.
2. Garanta que o provedor **Email** esteja ativado (`Enabled`).
3. (Recomendado para Testes Ágeis):
   - Vá em **Authentication** > **URL Configuration**.
   - Se preferir permitir que contas façam login imediatamente após cadastro sem aguardar e-mail de confirmação:
     - Vá em **Authentication** > **Providers** > **Email**.
     - Desative a opção **"Confirm email"** (Save).
     - Dessa forma, o cadastro e o login acontecem instantaneamente!

---

### Passo 4: Criar o Bucket de Armazenamento (Supabase Storage)
1. No menu lateral do Supabase, clique em **Storage**.
2. Clique em **"New Bucket"**.
3. Defina o nome do bucket exatamente como:
   `lune-media`
4. Marque a opção **"Public bucket"** para permitir que avatares e mídias sejam lidos diretamente pelos navegadores.
5. Clique em **"Create bucket"**.
6. Em **Configuration** > **Policies** do Storage, verifique se usuários autenticados têm permissão para fazer Upload (INSERT) de arquivos. Você pode executar o seguinte comando no SQL Editor:
   ```sql
   CREATE POLICY "Authenticated users can upload to lune-media"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'lune-media');

   CREATE POLICY "Public read for lune-media"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'lune-media');
   ```

---

### Passo 5: Ativar o Supabase Realtime
1. As tabelas já foram adicionadas à publicação `supabase_realtime` via migração SQL.
2. Para confirmar: acesse **Database** > **Publications** > `supabase_realtime`.
3. Garanta que as tabelas `profiles`, `friend_requests`, `friendships`, `messages`, `conversations` e `conversation_members` estejam com Realtime ativado.

---

### Passo 6: Obter as Chaves de Conexão
1. No Supabase, clique na engrenagem no canto inferior esquerdo (**Project Settings**).
2. Clique em **API**.
3. Localize:
   - **Project URL**: Uma URL no formato `https://xyzcompany.supabase.co`
   - **anon / public key**: Uma chave longa começando com `eyJhbGciOi...`
4. ⚠️ **ATENÇÃO DE SEGURANÇA:**
   - Use **APENAS** a chave `anon` (`public`). Ela foi projetada para uso seguro no frontend em conjunto com as políticas de Row Level Security (RLS).
   - **NUNCA** coloque a chave `service_role` no código fonte, no arquivo `.env` commitado ou no GitHub Pages. A chave `service_role` ignora todas as regras de segurança e deve permanecer estritamente secreta.

---

### Passo 7: Configurar Variáveis de Ambiente Localmente

Crie um arquivo `.env` na raiz do projeto (ele já está listado no `.gitignore` e não será commitado):

```env
VITE_SUPABASE_URL="https://SEU_PROJETO.supabase.co"
VITE_SUPABASE_ANON_KEY="SUA_CHAVE_ANON_AQUI"
```

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

---

### Passo 8: Configurar GitHub Secrets para Deploy no GitHub Pages
Se você utiliza o GitHub Actions configurado em `.github/workflows/deploy.yml`:
1. No seu repositório do GitHub, vá em **Settings** > **Secrets and variables** > **Actions**.
2. Clique em **"New repository secret"**.
3. Adicione:
   - Nome: `VITE_SUPABASE_URL` | Valor: sua Project URL
   - Nome: `VITE_SUPABASE_ANON_KEY` | Valor: sua anon public key
4. No arquivo `.github/workflows/deploy.yml`, garanta que a etapa de build injete essas variáveis durante o `npm run build`:
   ```yaml
   - name: Build
     run: npm run build
     env:
       VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
       VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
   ```

---

## 3. Teste de Verificação com Duas Contas Reais

Para verificar que a rede multi-usuário está 100% funcional entre dispositivos ou navegadores:

1. **Janela Normal (Navegador A):**
   - Acesse o LUNE.
   - Clique em **"Entrar no LUNE"** > **"Criar conta nova"**.
   - Cadastre:
     - Nome: `Pedro Lander`
     - Username: `pedro`
     - E-mail: `pedro@exemplo.com`
     - Senha: `uma_senha_forte`
   - Você entrará na conta `@pedro`.

2. **Janela Anônima ou Outro Computador/Celular (Navegador B):**
   - Acesse o LUNE.
   - Clique em **"Criar conta nova"**.
   - Cadastre:
     - Nome: `Carlos Silva`
     - Username: `carlos`
     - E-mail: `carlos@exemplo.com`
     - Senha: `outra_senha_forte`
   - Você entrará na conta `@carlos`.

3. **Busca Global e Solicitação de Amizade:**
   - Na conta do **Pedro (Navegador A)**, vá na aba **Amigos** > **Adicionar Amigo**.
   - Digite `@carlos`.
   - A conta real do Carlos aparecerá nos resultados vindos do PostgreSQL remoto.
   - Clique em **Adicionar Amigo**.

4. **Recebimento e Aceitação em Tempo Real:**
   - No **Navegador B (Carlos)**, o sino/notificação de solicitação pendente atualizará em tempo real ou na aba **Pendentes**.
   - Clique em **Aceitar**.
   - Ambos os usuários agora veem um ao outro permanentemente na lista de **Amigos**.

5. **Troca de Mensagens Persistentes:**
   - No Navegador A, clique no ícone de Mensagem ao lado de Carlos para abrir o chat.
   - Envie: `"Olá Carlos, teste do LUNE em nuvem!"`.
   - No Navegador B, a mensagem aparece instantaneamente via Supabase Realtime.
   - Carlos responde: `"Recebido perfeitamente!"`.

6. **Validação de Persistência:**
   - Atualize a página nos dois navegadores (`F5`).
   - As sessões continuam ativas, a amizade permanece intacta e as mensagens estão gravadas no banco de dados.
   - Faça Logout e Login novamente: o histórico e perfil permanecem preservados.
