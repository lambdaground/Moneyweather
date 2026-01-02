import express, { type Request, Response, NextFunction } from "express";
// 1. .js 확장자 제거 (가장 중요!)
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

// 4. 에러 핸들러 및 설정 (유지 및 보완)
let routesRegistered = false;

export async function setupApp() {
  if (!routesRegistered) {
    await registerRoutes(httpServer, app);
    
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

// 5. [추가] 로컬 개발 환경 실행 코드
// Vercel은 이 부분을 실행하지 않고 export된 app만 가져가지만,
// 'npm run dev'로 실행할 때는 이 부분이 서버를 켜줍니다.
if (process.env.NODE_ENV !== "production") {
  setupApp().then(() => {
    const PORT = 5000;
    httpServer.listen(PORT, () => {
      log(`serving on port ${PORT}`);
    });
  }).catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default app;
