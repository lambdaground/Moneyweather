// script/execute-cron.ts
import { runCronJob } from "../server/cron-job";

async function main() {
  console.log("🚀 데이터 업데이트 스크립트 가동...");
  try {
    // 수동 실행 모드(true)로 호출
    const result = await runCronJob(true);
    console.log("✨ 업데이트 완료:", result);
    process.exit(0);
  } catch (error) {
    console.error("❌ 업데이트 중 치명적 오류 발생:", error);
    process.exit(1);
  }
}

main();
