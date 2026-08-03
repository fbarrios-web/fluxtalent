import { EN_PUBLIC } from "./en.public";
import { EN_APP } from "./en.app";
import { EN_VACANCIES } from "./en.vacancies";
import { EN_ADMIN } from "./en.admin";
import { EN_MISC } from "./en.misc";

/**
 * English overrides keyed by the Spanish source string.
 * Any string not present here falls back to the Spanish original.
 */
const BASE: Record<string, string> = {
  // Navegación / layout
  "Dashboard": "Dashboard",
  "Vacantes": "Job openings",
  "Multi-organización": "Multi-organization",
  "Suscripción": "Subscription",
  "Configuración": "Settings",
  "Admin": "Admin",
  "Salir": "Sign out",
  "Menú": "Menu",
  "Ayuda": "Help",
  "Ayuda / Recorrido guiado": "Help / Guided tour",
  "Entrá a una vacante para verlo": "Open a job opening to see it",
  "Entrá a una postulación para verlo": "Open an application to see it",
  "© 2026 FLUX Automatizaciones. Todos los derechos reservados.": "© 2026 FLUX Automatizaciones. All rights reserved.",
  "Ir al inicio": "Go home",
  "Página no encontrada": "Page not found",
  "La página que estás buscando no existe o fue movida.": "The page you are looking for does not exist or was moved.",
  "Esta página no cargó": "This page failed to load",
  "Algo salió mal. Probá refrescar o volvé al inicio.": "Something went wrong. Try refreshing or go back home.",
  "Reintentar": "Retry",

  // Idioma
  "Idioma": "Language",
  "Español": "Spanish",
  "Inglés": "English",
  "Elegí el idioma de la interfaz.": "Choose the interface language.",
  "Automático (según tu país)": "Automatic (based on your country)",

  // Auth
  "Ingresar": "Sign in",
  "Entrar": "Sign in",
  "Crear cuenta": "Create account",
  "Crear una": "Create one",
  "Bienvenido de vuelta": "Welcome back",
  "Creá tu cuenta": "Create your account",
  "Ingresá para gestionar tus búsquedas.": "Sign in to manage your searches.",
  "Activá tu workspace en menos de 1 minuto.": "Set up your workspace in under a minute.",
  "Continuar con Google": "Continue with Google",
  "o con email": "or with email",
  "Empresa": "Company",
  "Nombre y apellido completo": "Full name",
  "DNI": "National ID",
  "Fecha de nac.": "Date of birth",
  "Email": "Email",
  "Contraseña": "Password",
  "¿Olvidaste tu contraseña?": "Forgot your password?",
  "Recuperar contraseña": "Reset password",
  "Te enviaremos un email con un enlace para restablecerla.": "We'll email you a link to reset it.",
  "Enviar email": "Send email",
  "Cancelar": "Cancel",
  "¿No tenés cuenta?": "Don't have an account?",
  "¿Ya tenés cuenta?": "Already have an account?",
  "Usuario duplicado": "Duplicate user",
  "¡Cuenta creada!": "Account created!",
  "Error de autenticación": "Authentication error",
  "Error con Google": "Google sign-in error",
  "Te enviamos un email para recuperar tu contraseña.": "We sent you an email to reset your password.",
  "No se pudo enviar el email": "The email could not be sent",
  "Mostrar contraseña": "Show password",
  "Ocultar contraseña": "Hide password",

  // Genéricos
  "Guardar": "Save",
  "Guardando…": "Saving…",
  "Guardado": "Saved",
  "Cargando…": "Loading…",
  "Eliminar": "Delete",
  "Editar": "Edit",
  "Cerrar": "Close",
  "Volver": "Back",
  "Siguiente": "Next",
  "Anterior": "Previous",
  "Buscar": "Search",
  "Estado": "Status",
  "Activo": "Active",
  "Inactivo": "Inactive",
  "Sí": "Yes",
  "No": "No",
};

export const EN: Record<string, string> = {
  ...EN_PUBLIC,
  ...EN_APP,
  ...EN_VACANCIES,
  ...EN_ADMIN,
  ...EN_MISC,
  ...BASE,
};
