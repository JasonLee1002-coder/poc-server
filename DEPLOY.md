# poc-server 部署指南（EC2）

## 一次性部署（SSH 進 EC2 後執行）

```bash
# 1. 拉程式碼
cd ~
git clone https://github.com/JasonLee1002-coder/poc-server.git
cd poc-server

# 2. 設定環境變數（從 Neon 取 DATABASE_URL）
cat > .env << 'EOF'
DATABASE_URL=<你的 Neon DATABASE_URL>
POC_PASSWORD=xu4bj6D1l41le4
PORT=3012
EOF

# 3. 啟動 Docker 容器
docker build -t poc-server .
docker run -d \
  --name poc-server \
  --restart always \
  -p 3012:3012 \
  --env-file .env \
  poc-server

# 4. 確認運行
docker ps | grep poc-server
curl http://localhost:3012/api/poc -H "x-poc-token: xu4bj6D1l41le4"
```

## 更新部署（之後有改動）

```bash
cd ~/poc-server
git pull
docker build -t poc-server .
docker stop poc-server && docker rm poc-server
docker run -d --name poc-server --restart always -p 3012:3012 --env-file .env poc-server
```

## Nginx 設定（如果 EC2 有 Nginx）

```nginx
server {
    listen 80;
    server_name poc.mcstation.ai;
    location / {
        proxy_pass http://localhost:3012;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Cloudflare DNS 設定

在 Cloudflare mcstation.ai 區域新增：
- **類型：** A
- **名稱：** poc
- **值：** 13.112.14.121
- **Proxy：** ✅ 橘雲（自動 HTTPS）

完成後即可用 https://poc.mcstation.ai 存取。
