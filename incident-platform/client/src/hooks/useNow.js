import { useEffect, useState } from "react";

// Re-renders every `interval` ms so SLA countdowns stay current
export default function useNow(interval = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}
