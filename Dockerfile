FROM node:21.5.0

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json/yarn.lock 文件
COPY package*.json yarn.lock ./
COPY buydip_scheme ./buydip_scheme

# 安装依赖
RUN yarn

# 复制项目文件到工作目录
COPY . .

# 设置环境变量
ENV PORT 4002

# 暴露端口
EXPOSE $PORT

# 启动 Next.js 应用
CMD ["yarn", "start"]