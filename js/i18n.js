// Interface translations.
//
// The language is a property of the event, not of each device: the host picks
// it in Setup and every attendee's phone follows, the same way they follow the
// current question. An audience shouldn't each be guessing at a setting.
//
// `{n}`-style placeholders are filled by the second argument to t().

// Flags stand in for languages here, which isn't strictly right — Spanish
// isn't only Spain, and English isn't only Britain — but for picking between
// five European languages it reads faster than text alone.
export const LANGUAGES = {
  en: "🇬🇧 English",
  pt: "🇵🇹 Português",
  es: "🇪🇸 Español",
  fr: "🇫🇷 Français",
  de: "🇩🇪 Deutsch",
};

export const DEFAULT_LANGUAGE = "en";

const strings = {
  en: {
    hostControl: "Host control",
    livePoll: "Live poll",
    tabSetup: "Setup poll",
    tabRun: "Run poll",

    questionN: "Question {n}",
    editingQuestionN: "Editing question {n}",
    optionsLabel: "Options — one per line",
    correctLabel: "Right answer — optional",
    noRightAnswer: "No right answer",
    addOptionsFirst: "Add options above to mark one as right.",
    addQuestion: "Add question",
    saveChanges: "Save changes",
    cancel: "Cancel",
    noQuestionsYet: "No questions yet — add your first above.",
    optionsCount: "{n} options",
    needTwoOptions: "Need 2+ options",
    language: "Language",
    questionPlaceholder: "What's your age?",
    optionsPlaceholder: "Under 30\n30–50\nOver 50",

    moveUp: "Move up",
    moveDown: "Move down",
    edit: "Edit",
    delete: "Delete",

    start: "Start",
    revealAnswer: "Reveal answer",
    next: "Next ›",
    prev: "‹ Prev",
    reopenVoting: "Reopen voting",
    resetVotes: "Reset votes",
    resetAllVotes: "Reset all votes",
    startOver: "Start over",
    hideScreen: "Hide screen",
    showScreen: "Show screen",

    nothingOnScreen: "Nothing on screen",
    noQuestions: "No questions yet",
    pressStart: "Press Start to put the first question up.",
    addInSetup: "Add questions in Setup first.",
    screenHidden: "Screen hidden",
    screenHiddenNote: "The audience sees a waiting screen. Show it again when you're ready.",
    attendeesHint: "Attendees open {url}",
    viewOnly: "Another device owns this event — view only",
    voteCount: "{n} votes in",
    voteCountOne: "1 vote in",
    votingClosedSuffix: " · voting closed",

    waitingForHost: "Waiting for the host to put a question up.",
    oneVotePerQuestion: "One vote per question",
    questionNofM: "Question {n} of {m}",
    votingClosed: "Voting closed",
    voteFor: "Vote for {label}",
    cantConnect: "Can't connect",
    tryAgain: "Try again",
    signIn: "Sign in with Google",
    signOut: "Sign out",
    qrCode: "QR code",
    close: "Close",
    signInPrompt: "Sign in to run this event",
    signedInAs: "Signed in as {name}",
    charCount: "{n} / {max}",
    longestOption: "Longest {n} / {max}",
    optionTooLong: "Answer {i} is {n} characters. The limit is {max}.",

    connecting: "Connecting",
    live: "Live",
    offline: "Offline",
    setupNeeded: "Setup needed",
    broken: "Broken",
    refused: "Refused",
    voteRefused: "Vote refused",
    added: "Added",
    saved: "Saved",
    moved: "Moved",
    deleted: "Deleted",
    revealed: "Revealed",
    reopened: "Reopened",
    reset: "Reset",
    hidden: "Hidden",
    shown: "Shown",
  },

  pt: {
    hostControl: "Controlo",
    livePoll: "Votação em direto",
    tabSetup: "Preparar votação",
    tabRun: "Apresentar votação",

    questionN: "Pergunta {n}",
    editingQuestionN: "A editar pergunta {n}",
    optionsLabel: "Opções — uma por linha",
    correctLabel: "Resposta certa — opcional",
    noRightAnswer: "Sem resposta certa",
    addOptionsFirst: "Adiciona opções acima para marcares a certa.",
    addQuestion: "Adicionar pergunta",
    saveChanges: "Guardar alterações",
    cancel: "Cancelar",
    noQuestionsYet: "Ainda sem perguntas — adiciona a primeira acima.",
    optionsCount: "{n} opções",
    needTwoOptions: "Mínimo 2 opções",
    language: "Idioma",
    questionPlaceholder: "Que idade tens?",
    optionsPlaceholder: "Menos de 30\n30–50\nMais de 50",

    moveUp: "Mover para cima",
    moveDown: "Mover para baixo",
    edit: "Editar",
    delete: "Remover",

    start: "Iniciar",
    revealAnswer: "Revelar resposta",
    next: "Seguinte ›",
    prev: "‹ Anterior",
    reopenVoting: "Reabrir votação",
    resetVotes: "Limpar votos",
    resetAllVotes: "Limpar todos os votos",
    startOver: "Recomeçar",
    hideScreen: "Ocultar ecrã",
    showScreen: "Mostrar ecrã",

    nothingOnScreen: "Nada no ecrã",
    noQuestions: "Ainda sem perguntas",
    pressStart: "Toca em Iniciar para mostrar a primeira pergunta.",
    addInSetup: "Adiciona perguntas na Preparação primeiro.",
    screenHidden: "Ecrã oculto",
    screenHiddenNote: "O público vê um ecrã de espera. Mostra outra vez quando quiseres.",
    attendeesHint: "Os participantes abrem {url}",
    viewOnly: "Outro dispositivo controla este evento — apenas leitura",
    voteCount: "{n} votos",
    voteCountOne: "1 voto",
    votingClosedSuffix: " · votação encerrada",

    waitingForHost: "A aguardar que o apresentador mostre uma pergunta.",
    oneVotePerQuestion: "Um voto por pergunta",
    questionNofM: "Pergunta {n} de {m}",
    votingClosed: "Votação encerrada",
    voteFor: "Votar em {label}",
    cantConnect: "Sem ligação",
    tryAgain: "Tentar de novo",
    signIn: "Entrar com Google",
    signOut: "Sair",
    qrCode: "Código QR",
    close: "Fechar",
    signInPrompt: "Entra para conduzires este evento",
    signedInAs: "Sessão de {name}",
    charCount: "{n} / {max}",
    longestOption: "Maior {n} / {max}",
    optionTooLong: "A resposta {i} tem {n} caracteres. O limite é {max}.",

    connecting: "A ligar",
    live: "Live",
    offline: "Sem ligação",
    setupNeeded: "Falta configurar",
    broken: "Erro",
    refused: "Recusado",
    voteRefused: "Voto recusado",
    added: "Adicionada",
    saved: "Guardada",
    moved: "Movida",
    deleted: "Removida",
    revealed: "Revelada",
    reopened: "Reaberta",
    reset: "Limpa",
    hidden: "Oculto",
    shown: "Visível",
  },

  es: {
    hostControl: "Control",
    livePoll: "Votación en directo",
    tabSetup: "Preparar votación",
    tabRun: "Presentar votación",

    questionN: "Pregunta {n}",
    editingQuestionN: "Editando pregunta {n}",
    optionsLabel: "Opciones — una por línea",
    correctLabel: "Respuesta correcta — opcional",
    noRightAnswer: "Sin respuesta correcta",
    addOptionsFirst: "Añade opciones arriba para marcar la correcta.",
    addQuestion: "Añadir pregunta",
    saveChanges: "Guardar cambios",
    cancel: "Cancelar",
    noQuestionsYet: "Aún no hay preguntas — añade la primera arriba.",
    optionsCount: "{n} opciones",
    needTwoOptions: "Mínimo 2 opciones",
    language: "Idioma",
    questionPlaceholder: "¿Qué edad tienes?",
    optionsPlaceholder: "Menos de 30\n30–50\nMás de 50",

    moveUp: "Subir",
    moveDown: "Bajar",
    edit: "Editar",
    delete: "Eliminar",

    start: "Iniciar",
    revealAnswer: "Revelar respuesta",
    next: "Siguiente ›",
    prev: "‹ Anterior",
    reopenVoting: "Reabrir votación",
    resetVotes: "Borrar votos",
    resetAllVotes: "Borrar todos los votos",
    startOver: "Empezar de nuevo",
    hideScreen: "Ocultar pantalla",
    showScreen: "Mostrar pantalla",

    nothingOnScreen: "Nada en pantalla",
    noQuestions: "Aún no hay preguntas",
    pressStart: "Pulsa Iniciar para mostrar la primera pregunta.",
    addInSetup: "Añade preguntas en Preparación primero.",
    screenHidden: "Pantalla oculta",
    screenHiddenNote: "El público ve una pantalla de espera. Muéstrala cuando quieras.",
    attendeesHint: "El público abre {url}",
    viewOnly: "Otro dispositivo controla este evento — solo lectura",
    voteCount: "{n} votos",
    voteCountOne: "1 voto",
    votingClosedSuffix: " · votación cerrada",

    waitingForHost: "Esperando a que el anfitrión muestre una pregunta.",
    oneVotePerQuestion: "Un voto por pregunta",
    questionNofM: "Pregunta {n} de {m}",
    votingClosed: "Votación cerrada",
    voteFor: "Votar por {label}",
    cantConnect: "Sin conexión",
    tryAgain: "Reintentar",
    signIn: "Entrar con Google",
    signOut: "Cerrar sesión",
    qrCode: "Código QR",
    close: "Cerrar",
    signInPrompt: "Inicia sesión para dirigir este evento",
    signedInAs: "Sesión de {name}",
    charCount: "{n} / {max}",
    longestOption: "Máx. {n} / {max}",
    optionTooLong: "La respuesta {i} tiene {n} caracteres. El límite es {max}.",

    connecting: "Conectando",
    live: "Live",
    offline: "Sin conexión",
    setupNeeded: "Falta configurar",
    broken: "Error",
    refused: "Rechazado",
    voteRefused: "Voto rechazado",
    added: "Añadida",
    saved: "Guardada",
    moved: "Movida",
    deleted: "Eliminada",
    revealed: "Revelada",
    reopened: "Reabierta",
    reset: "Borrada",
    hidden: "Oculta",
    shown: "Visible",
  },

  fr: {
    hostControl: "Contrôle",
    livePoll: "Vote en direct",
    tabSetup: "Préparer le vote",
    tabRun: "Lancer le vote",

    questionN: "Question {n}",
    editingQuestionN: "Modification de la question {n}",
    optionsLabel: "Options — une par ligne",
    correctLabel: "Bonne réponse — facultatif",
    noRightAnswer: "Pas de bonne réponse",
    addOptionsFirst: "Ajoute des options ci-dessus pour en marquer une.",
    addQuestion: "Ajouter la question",
    saveChanges: "Enregistrer",
    cancel: "Annuler",
    noQuestionsYet: "Aucune question — ajoute la première ci-dessus.",
    optionsCount: "{n} options",
    needTwoOptions: "2 options minimum",
    language: "Langue",
    questionPlaceholder: "Quel âge as-tu ?",
    optionsPlaceholder: "Moins de 30\n30–50\nPlus de 50",

    moveUp: "Monter",
    moveDown: "Descendre",
    edit: "Modifier",
    delete: "Supprimer",

    start: "Démarrer",
    revealAnswer: "Révéler la réponse",
    next: "Suivant ›",
    prev: "‹ Précédent",
    reopenVoting: "Rouvrir le vote",
    resetVotes: "Effacer les votes",
    resetAllVotes: "Effacer tous les votes",
    startOver: "Recommencer",
    hideScreen: "Masquer l'écran",
    showScreen: "Afficher l'écran",

    nothingOnScreen: "Rien à l'écran",
    noQuestions: "Aucune question",
    pressStart: "Appuie sur Démarrer pour afficher la première question.",
    addInSetup: "Ajoute d'abord des questions dans Préparation.",
    screenHidden: "Écran masqué",
    screenHiddenNote: "Le public voit un écran d'attente. Affiche-le quand tu veux.",
    attendeesHint: "Le public ouvre {url}",
    viewOnly: "Un autre appareil contrôle cet événement — lecture seule",
    voteCount: "{n} votes",
    voteCountOne: "1 vote",
    votingClosedSuffix: " · vote clos",

    waitingForHost: "En attente d'une question.",
    oneVotePerQuestion: "Un vote par question",
    questionNofM: "Question {n} sur {m}",
    votingClosed: "Vote clos",
    voteFor: "Voter pour {label}",
    cantConnect: "Connexion impossible",
    tryAgain: "Réessayer",
    signIn: "Se connecter avec Google",
    signOut: "Se déconnecter",
    qrCode: "Code QR",
    close: "Fermer",
    signInPrompt: "Connecte-toi pour animer cet événement",
    signedInAs: "Connecté en tant que {name}",
    charCount: "{n} / {max}",
    longestOption: "Plus longue {n} / {max}",
    optionTooLong: "La réponse {i} fait {n} caractères. La limite est {max}.",

    connecting: "Connexion",
    live: "Live",
    offline: "Hors ligne",
    setupNeeded: "Configuration requise",
    broken: "Erreur",
    refused: "Refusé",
    voteRefused: "Vote refusé",
    added: "Ajoutée",
    saved: "Enregistrée",
    moved: "Déplacée",
    deleted: "Supprimée",
    revealed: "Révélée",
    reopened: "Rouverte",
    reset: "Effacé",
    hidden: "Masqué",
    shown: "Affiché",
  },

  de: {
    hostControl: "Steuerung",
    livePoll: "Live-Abstimmung",
    tabSetup: "Umfrage vorbereiten",
    tabRun: "Umfrage starten",

    questionN: "Frage {n}",
    editingQuestionN: "Frage {n} bearbeiten",
    optionsLabel: "Antworten — eine pro Zeile",
    correctLabel: "Richtige Antwort — optional",
    noRightAnswer: "Keine richtige Antwort",
    addOptionsFirst: "Füge oben Antworten hinzu, um eine zu markieren.",
    addQuestion: "Frage hinzufügen",
    saveChanges: "Änderungen speichern",
    cancel: "Abbrechen",
    noQuestionsYet: "Noch keine Fragen — füge oben die erste hinzu.",
    optionsCount: "{n} Antworten",
    needTwoOptions: "Mind. 2 Antworten",
    language: "Sprache",
    questionPlaceholder: "Wie alt bist du?",
    optionsPlaceholder: "Unter 30\n30–50\nÜber 50",

    moveUp: "Nach oben",
    moveDown: "Nach unten",
    edit: "Bearbeiten",
    delete: "Löschen",

    start: "Start",
    revealAnswer: "Antwort zeigen",
    next: "Weiter ›",
    prev: "‹ Zurück",
    reopenVoting: "Abstimmung öffnen",
    resetVotes: "Stimmen löschen",
    resetAllVotes: "Alle Stimmen löschen",
    startOver: "Neu beginnen",
    hideScreen: "Bildschirm ausblenden",
    showScreen: "Bildschirm einblenden",

    nothingOnScreen: "Nichts auf dem Bildschirm",
    noQuestions: "Noch keine Fragen",
    pressStart: "Tippe auf Start, um die erste Frage zu zeigen.",
    addInSetup: "Füge zuerst Fragen in der Vorbereitung hinzu.",
    screenHidden: "Bildschirm ausgeblendet",
    screenHiddenNote: "Das Publikum sieht einen Wartebildschirm. Blende ihn wieder ein, wenn du so weit bist.",
    attendeesHint: "Das Publikum öffnet {url}",
    viewOnly: "Ein anderes Gerät steuert dieses Event — nur Ansicht",
    voteCount: "{n} Stimmen",
    voteCountOne: "1 Stimme",
    votingClosedSuffix: " · Abstimmung beendet",

    waitingForHost: "Warten auf die nächste Frage.",
    oneVotePerQuestion: "Eine Stimme pro Frage",
    questionNofM: "Frage {n} von {m}",
    votingClosed: "Abstimmung beendet",
    voteFor: "Für {label} stimmen",
    cantConnect: "Keine Verbindung",
    tryAgain: "Erneut versuchen",
    signIn: "Mit Google anmelden",
    signOut: "Abmelden",
    qrCode: "QR-Code",
    close: "Schließen",
    signInPrompt: "Melde dich an, um dieses Event zu leiten",
    signedInAs: "Angemeldet als {name}",
    charCount: "{n} / {max}",
    longestOption: "Längste {n} / {max}",
    optionTooLong: "Antwort {i} hat {n} Zeichen. Erlaubt sind {max}.",

    connecting: "Verbinden",
    live: "Live",
    offline: "Offline",
    setupNeeded: "Einrichtung nötig",
    broken: "Fehler",
    refused: "Abgelehnt",
    voteRefused: "Stimme abgelehnt",
    added: "Hinzugefügt",
    saved: "Gespeichert",
    moved: "Verschoben",
    deleted: "Gelöscht",
    revealed: "Gezeigt",
    reopened: "Geöffnet",
    reset: "Gelöscht",
    hidden: "Ausgeblendet",
    shown: "Sichtbar",
  },
};

let current = DEFAULT_LANGUAGE;

/** Returns true when the language actually changed, so callers can re-render. */
export function setLanguage(code) {
  const next = strings[code] ? code : DEFAULT_LANGUAGE;
  if (next === current) return false;
  current = next;
  return true;
}

export function getLanguage() {
  return current;
}

/** Looks up a string, falling back to English and then to the key itself. */
export function t(key, vars) {
  let text = strings[current][key] ?? strings[DEFAULT_LANGUAGE][key] ?? key;

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, value);
    }
  }
  return text;
}

/**
 * Fills every element carrying data-i18n (text) or data-i18n-placeholder,
 * so the markup keeps its English as a readable default and needs no
 * per-element wiring in the page scripts.
 */
export function applyStaticText(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  document.documentElement.lang = current;
}
