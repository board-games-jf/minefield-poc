// i18n — Minefield
// Supported locales: pt-BR-x-CE (default), pt-PT, en

export const LOCALES = ["pt-BR-x-CE", "pt-PT", "en"];

export const LOCALE_LABELS = {
  "pt-BR-x-CE": "Português (Ceará)",
  "pt-PT":      "Português (Portugal)",
  "en":         "English",
};

// HTML lang attribute to use per locale
export const LOCALE_LANG = {
  "pt-BR-x-CE": "pt-BR",
  "pt-PT":      "pt-PT",
  "en":         "en",
};

export const TRANSLATIONS = {
  "pt-BR-x-CE": {
    // App
    app_name: "Minefield",

    // Create screen
    create_title:       "Bora jogar!",
    name_label:         "Qual é o teu nome, meu?",
    name_placeholder:   "Ex: Zé",
    difficulty_label:   "Quão macho és?",
    diff_easy_name:     "Molezinha",
    diff_easy_desc:     "6 × 6 · 10 minas",
    diff_medium_name:   "Tá bom",
    diff_medium_desc:   "8 × 8 · 20 minas",
    diff_hard_name:     "Oxe, rapaiz!",
    diff_hard_desc:     "10 × 10 · 30 minas",
    btn_create:         "Bora jogar!",

    // Waiting screen
    waiting_title:      "Esperando o caba chegar...",
    invite_label:       "Manda esse link pro teu parceiro",
    btn_copy:           "Pega o link!",
    btn_copied:         "Pegô!",

    // Join screen
    join_title:         "Entrar na farra",
    invited_by:         "Chamado por",
    join_name_label:    "Qual é o teu nome, meu?",
    join_name_ph:       "Ex: Xuxa",
    btn_join:           "Entrar na farra",

    // Game screen
    turn_suffix:        "tá jogando",
    bombs_remaining:    (n) => `${n} ${n === 1 ? "mina" : "minas"} aí ainda`,
    bomb_count:         (n) => `${n} ${n === 1 ? "mina" : "minas"}`,
    btn_leave:          "Sair",

    // Result
    result_won:         (name) => `${name} ganhô!`,
    result_draw:        "Empatô, meu!",
    result_score:       (w, wb, l, lb) => `${w}: ${wb} ${wb === 1 ? "mina" : "minas"} · ${l}: ${lb} ${lb === 1 ? "mina" : "minas"}`,
    result_draw_score:  (n) => `Os dois acharam ${n} ${n === 1 ? "mina" : "minas"}`,
    btn_rematch:        "Duvido tu ir de novo",
    btn_new_game:       "Bora mais uma",

    // Errors
    error_name_required:  "Coloca teu nome, meu!",
    error_room_full:      "Essa farra já tá cheia!",
    error_room_finished:  "Essa partida já acabou, meu.",
    error_room_not_found: "Essa sala não existe não, véi.",
    error_generic:        "Deu ruim aí, meu.",
    error_title_full:     "Tá cheio!",
    error_title_finished: "Acabou!",
    error_title_generic:  "Eita!",
    btn_new_room:         "Bora mais uma",

    // Reconnect
    reconnecting:         "Reconectando, aguenta aí...",
  },

  "pt-PT": {
    app_name: "Minefield",

    create_title:       "Nova partida",
    name_label:         "O teu nome",
    name_placeholder:   "Ex: João",
    difficulty_label:   "Dificuldade",
    diff_easy_name:     "Fácil",
    diff_easy_desc:     "6 × 6 · 10 bombas",
    diff_medium_name:   "Médio",
    diff_medium_desc:   "8 × 8 · 20 bombas",
    diff_hard_name:     "Difícil",
    diff_hard_desc:     "10 × 10 · 30 bombas",
    btn_create:         "Criar partida",

    waiting_title:      "Aguardando adversário...",
    invite_label:       "Partilha este link com o teu amigo",
    btn_copy:           "Copiar link",
    btn_copied:         "Copiado!",

    join_title:         "Entrar na partida",
    invited_by:         "Convidado por",
    join_name_label:    "O teu nome",
    join_name_ph:       "Ex: Maria",
    btn_join:           "Entrar na partida",

    turn_suffix:        "vez de jogar",
    bombs_remaining:    (n) => `${n} ${n === 1 ? "bomba" : "bombas"} restantes`,
    bomb_count:         (n) => `${n} ${n === 1 ? "bomba" : "bombas"}`,
    btn_leave:          "Sair",

    result_won:         (name) => `${name} venceu!`,
    result_draw:        "Empate!",
    result_score:       (w, wb, l, lb) => `${w}: ${wb} ${wb === 1 ? "bomba" : "bombas"} · ${l}: ${lb} ${lb === 1 ? "bomba" : "bombas"}`,
    result_draw_score:  (n) => `Ambos encontraram ${n} ${n === 1 ? "bomba" : "bombas"}`,
    btn_rematch:        "Revanche",
    btn_new_game:       "Nova partida",

    error_name_required:  "Insere o teu nome para continuar.",
    error_room_full:      "Esta sala já tem dois jogadores.",
    error_room_finished:  "Esta partida já chegou ao fim.",
    error_room_not_found: "Esta sala não existe ou já terminou.",
    error_generic:        "Ocorreu um erro inesperado.",
    error_title_full:     "Partida em curso",
    error_title_finished: "Partida terminada",
    error_title_generic:  "Erro",
    btn_new_room:         "Nova partida",

    reconnecting:         "A reconectar...",
  },

  "en": {
    app_name: "Minefield",

    create_title:       "New game",
    name_label:         "Your name",
    name_placeholder:   "e.g. Alice",
    difficulty_label:   "Difficulty",
    diff_easy_name:     "Easy",
    diff_easy_desc:     "6 × 6 · 10 bombs",
    diff_medium_name:   "Medium",
    diff_medium_desc:   "8 × 8 · 20 bombs",
    diff_hard_name:     "Hard",
    diff_hard_desc:     "10 × 10 · 30 bombs",
    btn_create:         "Create game",

    waiting_title:      "Waiting for opponent...",
    invite_label:       "Share this link with your friend",
    btn_copy:           "Copy link",
    btn_copied:         "Copied!",

    join_title:         "Join game",
    invited_by:         "Invited by",
    join_name_label:    "Your name",
    join_name_ph:       "e.g. Bob",
    btn_join:           "Join game",

    turn_suffix:        "to play",
    bombs_remaining:    (n) => `${n} ${n === 1 ? "bomb" : "bombs"} left`,
    bomb_count:         (n) => `${n} ${n === 1 ? "bomb" : "bombs"}`,
    btn_leave:          "Leave",

    result_won:         (name) => `${name} won!`,
    result_draw:        "Draw!",
    result_score:       (w, wb, l, lb) => `${w}: ${wb} ${wb === 1 ? "bomb" : "bombs"} · ${l}: ${lb} ${lb === 1 ? "bomb" : "bombs"}`,
    result_draw_score:  (n) => `Both found ${n} ${n === 1 ? "bomb" : "bombs"}`,
    btn_rematch:        "Rematch",
    btn_new_game:       "New game",

    error_name_required:  "Please enter your name to continue.",
    error_room_full:      "This room is already full.",
    error_room_finished:  "This game has already ended.",
    error_room_not_found: "This room does not exist or has ended.",
    error_generic:        "An unexpected error occurred.",
    error_title_full:     "Game in progress",
    error_title_finished: "Game ended",
    error_title_generic:  "Error",
    btn_new_room:         "New game",

    reconnecting:         "Reconnecting...",
  },
};
