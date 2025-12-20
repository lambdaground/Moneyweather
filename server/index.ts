import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// 1. 기본 설정 (유지)
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 2. 로그 함수 (유지)
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// 3. 로깅 미들웨어 (유지)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });
  next();
});

// 4. 에러 핸들러 (유지)
// 주의: 라우트 등록 후에 에러 핸들러가 와야 하므로, 
// 여기서는 일반적인 미들웨어로만 두고, registerRoutes 내부에서 에러 처리를 하거나
// setupApp 실행 시점에 순서를 보장해야 합니다. 
// 하지만 기존 구조를 유지하기 위해 아래 함수를 export 합니다.

// ⭐️ 중요: 라우트 등록 상태를 체크하는 변수
let routesRegistered = false;

// ⭐️ 중요: Vercel이 호출할 초기화 함수
export async function setupApp() {
  if (!routesRegistered) {
    await registerRoutes(httpServer, app);
    
    // 에러 핸들러는 라우트 등록 후에 붙어야 가장 안전합니다.
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });

    routesRegistered = true;
  }
  return app;
}

export default app;
