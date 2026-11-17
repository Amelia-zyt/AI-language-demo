import { toast, content, profile } from "./useProfile";
import { player } from "./usePlayer";
export function speak(text: string, language?: string, rate = 0.8) {
  player.pause();
  if (!("speechSynthesis" in window)) {
    toast("当前浏览器不支持语音朗读");
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang =
    language || content.value?.languages[profile.lang][2] || "en-GB";
  utterance.rate = rate;
  utterance.onerror = (e) => {
    if (!["canceled", "interrupted"].includes(e.error))
      toast("设备语音不可用，请检查系统语音包");
  };
  speechSynthesis.speak(utterance);
}
interface RecognitionResult {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
interface BrowserRecognition {
  lang: string;
  interimResults: boolean;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  abort: () => void;
}
export function dictate(onResult: (text: string) => void) {
  const browser = window as unknown as {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  const Constructor =
    browser.SpeechRecognition || browser.webkitSpeechRecognition;
  if (!Constructor) {
    toast("当前浏览器不支持语音输入，请直接输入");
    return;
  }
  const recognition = new Constructor();
  recognition.lang = content.value?.languages[profile.lang][2] || "en-GB";
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    onResult(e.results[0][0].transcript);
    toast("已识别，请确认后提交");
  };
  recognition.onerror = () => toast("未能识别，请重试或输入答案");
  recognition.start();
  toast("请说出对应词语…");
  return () => recognition.abort();
}
