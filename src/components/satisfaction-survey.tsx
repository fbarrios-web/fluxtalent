import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDueSurvey, submitSurvey } from "@/lib/surveys.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SatisfactionSurvey() {
  const getDue = useServerFn(getDueSurvey);
  const submit = useServerFn(submitSurvey);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["due-survey"],
    queryFn: () => getDue(),
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  const [open, setOpen] = useState(false);
  const [nps, setNps] = useState<number | null>(null);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.dueBucket) {
      // Avoid hammering the user: only show once per session per bucket
      const key = `flux.survey.dismissed.${data.dueBucket}`;
      if (!sessionStorage.getItem(key)) setOpen(true);
    }
  }, [data?.dueBucket]);

  if (!data?.dueBucket) return null;
  const bucket = data.dueBucket;

  const handleClose = (v: boolean) => {
    if (!v) sessionStorage.setItem(`flux.survey.dismissed.${bucket}`, "1");
    setOpen(v);
  };

  async function send() {
    if (nps == null) return;
    setSaving(true);
    try {
      await submit({ data: { bucket, nps, comments: comments.trim() || null } });
      toast.success("¡Gracias por tu feedback!");
      await qc.invalidateQueries({ queryKey: ["due-survey"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al enviar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Sparkles className="h-5 w-5 text-primary" /> ¿Cómo va tu experiencia?
          </DialogTitle>
          <DialogDescription>
            Llevás {bucket} días con FLUX Talent. Tu opinión nos ayuda a mejorar el producto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">
              ¿Qué tan probable es que recomiendes FLUX Talent a un colega? (0 = nada · 10 = lo recomendaría seguro)
            </p>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => i).map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setNps(i)}
                  className={cn(
                    "rounded-md border py-2 text-sm font-semibold transition",
                    nps === i
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">¿Algo que quieras contarnos? (opcional)</label>
            <Textarea
              rows={3}
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Lo que más te gusta, lo que mejorarías, problemas que encontraste…"
              maxLength={2000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => handleClose(false)}>Más tarde</Button>
            <Button onClick={send} disabled={nps == null || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
