import { useState } from "react";
import {
  SettingsOptionGroup,
  SettingsOptionRow,
} from "../src/features/settings/ui/SettingsOptionGroup";
import { SegmentedControl } from "../src/shared/ui/segmented-control";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../src/shared/ui/alert-dialog";
import {
  isChinese,
  locale,
  saveLocale,
  type Locale,
} from "./locale-runtime.mjs";

const t = (zh: string, en: string) => (isChinese ? zh : en);
const languages: { value: Locale; label: string }[] = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
];

// OpenAI: native settings/dialog components, with an explicit reload confirmation.
export function LanguageSetting() {
  const [requested, setRequested] = useState<Locale | null>(null);
  const [error, setError] = useState(false);
  return (
    <SettingsOptionGroup
      title={t("界面语言", "Interface language")}
      data-testid="ld-language-card"
    >
      <SettingsOptionRow>
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("语言", "Language")}</p>
          <p
            className="text-sm font-normal text-muted-foreground/70"
            data-settings-subcopy
          >
            {t(
              "仅影响此设备的界面；不翻译聊天内容或修改智能体语言。",
              "Applies to this device only; does not translate messages or change agent language.",
            )}
          </p>
        </div>
        <SegmentedControl<Locale>
          legend={t("界面语言", "Interface language")}
          optionTestIdPrefix="ld-language"
          options={languages}
          testId="ld-language-control"
          value={locale}
          onValueChange={(value) => {
            if (value !== locale) {
              setError(false);
              setRequested(value);
            }
          }}
        />
      </SettingsOptionRow>
      <AlertDialog
        open={requested !== null}
        onOpenChange={(open) => {
          if (!open) setRequested(null);
        }}
      >
        <AlertDialogContent data-testid="ld-language-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("切换语言并重新载入？", "Change language and reload?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "界面会短暂重新载入。请先发送或保存尚未完成的内容；未保存的编辑可能丢失。不会退出账号、删除身份或清空聊天，也不会重启服务端或 Hermes。",
                "The interface will briefly reload. Send or save unfinished work first; unsaved edits may be lost. This does not sign you out, remove your identity, clear chats, or restart the server or Hermes.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert">
              {t(
                "无法保存本机语言设置，尚未重新载入，请检查本地存储后重试。",
                "Could not save the language preference. No reload occurred; check local storage and try again.",
              )}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="ld-language-cancel">
              {t("取消", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="ld-language-apply"
              onClick={(event) => {
                event.preventDefault();
                if (!requested) return;
                try {
                  saveLocale(requested);
                  window.location.reload();
                } catch {
                  setError(true);
                }
              }}
            >
              {t("保存并重新载入", "Save and reload")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsOptionGroup>
  );
}
