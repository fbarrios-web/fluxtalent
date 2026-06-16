// Client-safe email HTML builders (no server-only imports).

type BrandCtx = {
  consultancyName: string;
  contactEmail?: string | null;
  brandColor: string;
  logoUrl?: string | null;
  signatureHtml?: string | null;
};

function shell(brand: BrandCtx, inner: string) {
  const color = brand.brandColor || "#0F766E";
  const logo = brand.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${escapeAttr(brand.consultancyName)}" style="max-height:48px;margin-bottom:16px"/>`
    : `<div style="font-size:20px;font-weight:700;color:${color};margin-bottom:16px">${escapeHtml(brand.consultancyName)}</div>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
      ${logo}
      ${inner}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <div style="font-size:13px;color:#6b7280;line-height:1.5">
        ${brand.signatureHtml || `<strong>${escapeHtml(brand.consultancyName)}</strong>`}
        ${brand.contactEmail ? `<div style="margin-top:4px">Consultas: <a style="color:${color}" href="mailto:${brand.contactEmail}">${escapeHtml(brand.contactEmail)}</a></div>` : ""}
      </div>
    </div>
    <div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:12px">Enviado mediante FLUX Talent</div>
  </div>
  </body></html>`;
}

export function interviewInviteHtml(opts: BrandCtx & {
  firstName: string;
  vacancyTitle: string;
  scheduleUrl: string;
  stageLabel: string;
}) {
  const color = opts.brandColor || "#0F766E";
  return shell(opts, `
    <h1 style="font-size:22px;margin:0 0 12px">Hola ${escapeHtml(opts.firstName)},</h1>
    <p style="line-height:1.6;font-size:15px;margin:0 0 16px">
      Queremos avanzar con vos en el proceso de <strong>${escapeHtml(opts.vacancyTitle)}</strong>. Te invitamos a coordinar la <strong>${escapeHtml(opts.stageLabel)}</strong>.
    </p>
    <p style="line-height:1.6;font-size:15px;margin:0 0 24px">Elegí el horario que mejor te quede:</p>
    <p style="margin:0 0 24px">
      <a href="${opts.scheduleUrl}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Seleccionar horario</a>
    </p>
    <p style="font-size:13px;color:#6b7280;margin:0">Si el botón no funciona, copiá este link: <br/><span style="word-break:break-all">${opts.scheduleUrl}</span></p>
  `);
}

export function interviewConfirmCandidateHtml(opts: BrandCtx & {
  firstName: string;
  vacancyTitle: string;
  whenLabel: string;
  meetLink: string;
}) {
  const color = opts.brandColor || "#0F766E";
  return shell(opts, `
    <h1 style="font-size:22px;margin:0 0 12px">¡Listo, ${escapeHtml(opts.firstName)}!</h1>
    <p style="line-height:1.6;font-size:15px;margin:0 0 16px">Tu entrevista para <strong>${escapeHtml(opts.vacancyTitle)}</strong> quedó confirmada.</p>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid ${color}">
      <div style="font-size:13px;color:#6b7280;margin-bottom:4px">Fecha y hora</div>
      <div style="font-size:16px;font-weight:600">${escapeHtml(opts.whenLabel)}</div>
    </div>
    <p style="margin:16px 0">
      <a href="${opts.meetLink}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Unirme a la videollamada</a>
    </p>
    <p style="font-size:13px;color:#6b7280;margin:0">Te llegará también una invitación de Google Calendar.</p>
  `);
}

export function interviewConfirmRecruiterHtml(opts: BrandCtx & {
  candidateName: string;
  candidateEmail: string;
  vacancyTitle: string;
  whenLabel: string;
  meetLink: string;
}) {
  const color = opts.brandColor || "#0F766E";
  return shell(opts, `
    <h1 style="font-size:20px;margin:0 0 12px">Nueva entrevista agendada</h1>
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:0 0 16px">
      <div><strong>Postulante:</strong> ${escapeHtml(opts.candidateName)} (${escapeHtml(opts.candidateEmail)})</div>
      <div style="margin-top:6px"><strong>Vacante:</strong> ${escapeHtml(opts.vacancyTitle)}</div>
      <div style="margin-top:6px"><strong>Cuándo:</strong> ${escapeHtml(opts.whenLabel)}</div>
    </div>
    <p><a href="${opts.meetLink}" style="color:${color}">${opts.meetLink}</a></p>
  `);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string) { return escapeHtml(s); }
