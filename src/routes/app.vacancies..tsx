
function EditVacancyDialog({ vacancy, onSaved }: { vacancy: any; onSaved: () => void }) {
  const update = useServerFn(updateVacancy);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patch, setPatch] = useState({
    title: vacancy.title ?? "",
    area: vacancy.area ?? "",
    description: vacancy.description ?? "",
    responsibilities: vacancy.responsibilities ?? "",
    requirements: vacancy.requirements ?? "",
    nice_to_have: vacancy.nice_to_have ?? "",
    min_match: vacancy.min_match ?? 60,
  });
  const [screening, setScreening] = useState<any[]>([]);
  const [loadedQs, setLoadedQs] = useState(false);

  useEffect(() => {
    if (!open || loadedQs) return;
    (async () => {
      const { data } = await supabase
        .from("screening_questions")
        .select("question, required, qtype, options, position")
        .eq("vacancy_id", vacancy.id)
        .order("position");
      setScreening((data ?? []).map((q: any) => ({
        question: q.question, required: q.required,
        qtype: q.qtype ?? "text", options: q.options ?? [],
      })));
      setLoadedQs(true);
    })();
  }, [open, loadedQs, vacancy.id]);

  async function save() {
    setSaving(true);
    try {
      await update({ data: { id: vacancy.id, patch, screening } as any });
      toast.success("Vacante actualizada");
      onSaved();
      setOpen(false);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Pencil className="mr-2 h-3.5 w-3.5" /> Editar</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Editar vacante</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Título</Label><Input value={patch.title} onChange={e => setPatch(p => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Área</Label><Input value={patch.area} onChange={e => setPatch(p => ({ ...p, area: e.target.value }))} /></div>
            </div>
            <div><Label>Descripción</Label><Textarea rows={3} value={patch.description} onChange={e => setPatch(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Responsabilidades</Label><Textarea rows={4} value={patch.responsibilities} onChange={e => setPatch(p => ({ ...p, responsibilities: e.target.value }))} /></div>
            <div><Label>Requisitos excluyentes</Label><Textarea rows={3} value={patch.requirements} onChange={e => setPatch(p => ({ ...p, requirements: e.target.value }))} /></div>
            <div><Label>Deseables</Label><Textarea rows={2} value={patch.nice_to_have} onChange={e => setPatch(p => ({ ...p, nice_to_have: e.target.value }))} /></div>
            <div>
              <Label>% mínimo de match: {patch.min_match}%</Label>
              <input type="range" min={0} max={100} step={5} value={patch.min_match}
                onChange={e => setPatch(p => ({ ...p, min_match: Number(e.target.value) }))}
                className="w-full accent-primary" />
            </div>
            <div>
              <Label className="mb-2 block">Preguntas de filtro</Label>
              {loadedQs ? <ScreeningEditor screening={screening} setScreening={setScreening} /> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
