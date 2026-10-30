import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  V3_CAPABILITIES,
  addComponentButton,
  parsePublicConfigJson,
  removeComponentButtonRef,
  setComponentCapabilities,
  setComponentConfig,
  updateComponentButton,
} from "./component-declarations";
import { dockComponent } from "./dock-template";
import type { RoomV3, V3Button } from "./v3-document";

type Props = {
  room: RoomV3;
  disabled: boolean;
  onChange: (room: RoomV3) => void;
  onMessage: (message: string) => void;
};

const selectStyle = "w-full rounded border bg-background p-2 text-sm";

export function V3DockDeclarationEditor(props: Props) {
  const dock = dockComponent(props.room);
  const [configText, setConfigText] = useState(() =>
    dock?.config ? JSON.stringify(dock.config, null, 2) : "",
  );
  useEffect(() => {
    setConfigText(dock?.config ? JSON.stringify(dock.config, null, 2) : "");
  }, [dock?.id, dock?.config]);
  if (!dock) return null;

  const apply = (operation: () => RoomV3) => {
    try {
      props.onChange(operation());
    } catch (error) {
      props.onMessage(String(error instanceof Error ? error.message : error));
    }
  };

  const buttons = (dock.buttonIds ?? [])
    .map((id) => props.room.buttons?.find((button) => button.id === id))
    .filter((button): button is V3Button => !!button);

  const toggleCapability = (capability: string, checked: boolean) => {
    const current = new Set(dock.capabilities);
    if (checked) current.add(capability);
    else current.delete(capability);
    apply(() => setComponentCapabilities(props.room, dock.id, [...current]));
  };

  const chooseAction = (buttonId: string, value: string) => {
    const action: V3Button["action"] | null =
      value === "none"
        ? null
        : value === "desk.go"
          ? { type: "desk.go", deskId: props.room.startDesk }
          : { type: value as NonNullable<V3Button["action"]>["type"] };
    apply(() => updateComponentButton(props.room, dock.id, buttonId, { action }));
  };

  return (
    <section aria-label="本地 Dock 公开声明" className="space-y-4 rounded-lg border border-dashed p-3">
      <div>
        <h4 className="text-sm font-medium">本地 Dock 公开声明</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          声明作者作品需要的能力、按钮与公开 config。默认全部未勾选；声明不等于授权，保存并应用后可在「本机数据授权」允许读取。
        </p>
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{dock.entry}</p>
      </div>

      <fieldset disabled={props.disabled} className="space-y-2">
        <legend className="text-xs font-medium">能力声明</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {V3_CAPABILITIES.map(([id, label]) => (
            <label key={id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={"声明能力 " + label}
                checked={dock.capabilities.includes(id)}
                onChange={(e) => toggleCapability(id, e.target.checked)}
              />
              <span>{label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{id}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={props.disabled} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-xs font-medium">按钮声明</legend>
          <Button
            size="sm"
            variant="outline"
            disabled={props.disabled}
            onClick={() => apply(() => addComponentButton(props.room, dock.id, { name: "新按钮" }))}
          >
            添加按钮
          </Button>
        </div>
        {!buttons.length && <p className="text-xs text-muted-foreground">尚未声明按钮。作者 HTML 通过 buttonId 发布命中区后才能点击。</p>}
        {buttons.map((button) => (
          <div key={button.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={"按钮名称 " + button.id}
                className="min-w-40 flex-1"
                value={button.name}
                onChange={(e) => {
                  const name = e.target.value;
                  if (!name.trim()) return;
                  apply(() => updateComponentButton(props.room, dock.id, button.id, { name }));
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                aria-label={"移除按钮 " + button.name}
                onClick={() => apply(() => removeComponentButtonRef(props.room, dock.id, button.id))}
              >
                移除
              </Button>
            </div>
            <select
              aria-label={button.name + " 默认动作"}
              className={selectStyle}
              value={button.action?.type ?? "none"}
              onChange={(e) => chooseAction(button.id, e.target.value)}
            >
              <option value="none">不设默认动作</option>
              <option value="desk.previous">上一页</option>
              <option value="desk.next">下一页</option>
              <option value="desk.go">转到 Desk</option>
              <option value="binding.launch">待绑定应用</option>
              <option value="dext.exit">退出 Dext</option>
            </select>
            {button.action?.type === "desk.go" && (
              <select
                aria-label={button.name + " 目标 Desk"}
                className={selectStyle}
                value={button.action.deskId}
                onChange={(e) =>
                  apply(() =>
                    updateComponentButton(props.room, dock.id, button.id, {
                      action: { type: "desk.go", deskId: e.target.value },
                    }),
                  )
                }
              >
                {props.room.desks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            <details className="text-[10px] text-muted-foreground">
              <summary className="cursor-pointer">作者按钮标识</summary>
              <p className="mt-1 break-all">{button.id}</p>
            </details>
          </div>
        ))}
      </fieldset>

      <fieldset disabled={props.disabled} className="space-y-2">
        <legend className="text-xs font-medium">公开 config</legend>
        <textarea
          aria-label="公开 config JSON"
          className="min-h-28 w-full rounded border bg-background p-2 font-mono text-xs"
          spellCheck={false}
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          placeholder='{"theme":"clock"}'
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={props.disabled}
            onClick={() =>
              apply(() => {
                const parsed = parsePublicConfigJson(configText);
                return setComponentConfig(props.room, dock.id, parsed);
              })
            }
          >
            应用 config
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={props.disabled}
            onClick={() => {
              setConfigText("");
              apply(() => setComponentConfig(props.room, dock.id, undefined));
            }}
          >
            清除 config
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">只保存公开对象；禁止 target/token 等私有字段与本机绝对路径。</p>
      </fieldset>
    </section>
  );
}
