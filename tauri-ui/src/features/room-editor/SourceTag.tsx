export type FieldSource = "work" | "personal" | "machine";

const labels: Record<FieldSource, string> = {
  work: "作品",
  personal: "我的覆盖",
  machine: "本机设置",
};

export function SourceTag({source}: {source: FieldSource}) {
  return <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{labels[source]}</span>;
}
