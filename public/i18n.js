// i18n — Minefield
// Supported locales: pt-BR-x-CE (default), pt-PT, en

export const LOCALES = ["pt-BR-x-CE", "pt-PT", "en"];

export const LOCALE_LABELS = {
  "pt-BR-x-CE": "Português (Ceará)",
  "pt-PT":      "Português (Portugal)",
  "en":         "English",
};

// Flag to show in the locale selector (emoji keeps it zero-dependency).
export const LOCALE_FLAGS = {
  "pt-BR-x-CE": "🇧🇷",
  "pt-PT":      "🇵🇹",
  "en":         "🇺🇸",
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
    language_label: "Idioma",

    // Create screen
    create_title:       "Bora jogar!",
    name_label:         "Qual é o teu nome, ma?",
    name_placeholder:   "Ex: Zé",
    difficulty_label:   "Nível da peia",
    diff_easy_name:     "Molezinha",
    diff_easy_desc:     "6 × 6 · 10 bombas",
    diff_medium_name:   "Vixe!",
    diff_medium_desc:   "8 × 8 · 20 bombas",
    diff_hard_name:     "Cabra macho",
    diff_hard_desc:     "10 × 10 · 30 bombas",
    btn_create:         "Bora jogar!",
    solo_label:         "Jogar contra Máquina",
    solo_hint:          "Comeca na hora, sem precisar de parceiro",
    ai_level_label:     "Nivel da Máquina",
    ai_easy:            "De boa",
    ai_medium:          "Malemolente",
    ai_hard:            "Apelona",

    // Waiting screen
    waiting_title:      "Esperando o caba chegar...",
    invite_label:       "Manda esse link pro teu parceiro",
    btn_copy:           "Pega o link!",
    btn_copied:         "Pegô!",

    // Join screen
    join_title:         "Entrar na farra",
    invited_by:         "Chamado por",
    join_name_label:    "Qual é o teu nome, ma?",
    join_name_ph:       "Ex: Xuxa",
    btn_join:           "Entrar na farra",

    // Game screen
    turn_suffix:        "tá jogando",
    bombs_remaining:    (n) => `${n} ${n === 1 ? "mina" : "minas"} aí ainda`,
    bomb_count:         (n) => `${n} ${n === 1 ? "mina" : "minas"}`,
    btn_leave:          "Sair",
    sound_on_label:     "Som ligado",
    sound_off_label:    "Som desligado",
    sticker_launcher_label: "Abrir stickers",
    sticker_gg:         "GG",
    sticker_nice:       "Boa",
    sticker_thinking:   "Hmm",
    sticker_oops:       "Vacilei",
    sticker_sweat:      "Eita",
    sticker_boom:       "Boom",
    sticker_taunt:      "Risada",
    sticker_cry:        "Nooo",
    sticker_clap:       "Palmas",
    sticker_trophy:     "GG EZ",

    // Result
    result_won:         (name) => `${name} ganhô!`,
    result_draw:        "Empatô, ma!",
    result_score:       (w, wb, l, lb) => `${w}: ${wb} ${wb === 1 ? "mina" : "minas"} · ${l}: ${lb} ${lb === 1 ? "mina" : "minas"}`,
    result_draw_score:  (n) => `Os dois acharam ${n} ${n === 1 ? "mina" : "minas"}`,
    btn_rematch:        "Duvido tu ir de novo",
    btn_new_game:       "Bora mais uma",

    // Errors
    error_name_required:  "Coloca teu nome, ma!",
    error_room_full:      "Essa farra já tá cheia!",
    error_room_finished:  "Essa partida já acabou, ma.",
    error_room_not_found: "Essa sala não existe não, véi.",
    error_name_reserved:  "Esse nome é reservado pra Máquina, ma! Escolhe outro.",
    error_generic:        "Deu ruim aí, ma.",
    error_title_full:     "Tá cheio!",
    error_title_finished: "Acabou!",
    error_title_generic:  "Eita!",
    btn_new_room:         "Bora mais uma",

    // Reconnect
    reconnecting:         "Reconectando, aguenta aí...",

    // Ranking
    ranking_btn_label:    "Ranking",
    ranking_top10_title:  "🏆 Top 10",
    ranking_top3_title:   "🏆 Top 3",
    ranking_you:          "(você)",
    ranking_your_position:"Sua posição",
    ranking_points_label: "pontos",
    ranking_wins_label:   "vitórias",
    ranking_close_label:  "Fechar",
    ranking_empty:        "Ainda não tem ranking.",
  },

  "pt-PT": {
    app_name: "Minefield",
    language_label: "Idioma",

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
    solo_label:         "Jogar contra IA",
    solo_hint:          "Comeca de imediato, sem adversario",
    ai_level_label:     "Nivel da IA",
    ai_easy:            "Facil",
    ai_medium:          "Medio",
    ai_hard:            "Dificil",

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
    sound_on_label:     "Som ligado",
    sound_off_label:    "Som desligado",
    sticker_launcher_label: "Abrir stickers",
    sticker_gg:         "GG",
    sticker_nice:       "Boa",
    sticker_thinking:   "Hmm",
    sticker_oops:       "Ups",
    sticker_sweat:      "Ai",
    sticker_boom:       "Boom",
    sticker_taunt:      "Riso",
    sticker_cry:        "Nooo",
    sticker_clap:       "Palmas",
    sticker_trophy:     "GG EZ",

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
    error_name_reserved:  "Esse nome está reservado para a IA. Escolhe outro.",
    error_generic:        "Ocorreu um erro inesperado.",
    error_title_full:     "Partida em curso",
    error_title_finished: "Partida terminada",
    error_title_generic:  "Erro",
    btn_new_room:         "Nova partida",

    reconnecting:         "A reconectar...",

    // Ranking
    ranking_btn_label:    "Ranking",
    ranking_top10_title:  "🏆 Top 10",
    ranking_top3_title:   "🏆 Top 3",
    ranking_you:          "(tu)",
    ranking_your_position:"A tua posição",
    ranking_points_label: "pontos",
    ranking_wins_label:   "vitórias",
    ranking_close_label:  "Fechar",
    ranking_empty:        "Ainda não há ranking.",
  },

  "en": {
    app_name: "Minefield",
    language_label: "Language",

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
    solo_label:         "Play vs AI",
    solo_hint:          "Starts immediately, no opponent needed",
    ai_level_label:     "AI level",
    ai_easy:            "Easy",
    ai_medium:          "Medium",
    ai_hard:            "Hard",

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
    sound_on_label:     "Sound on",
    sound_off_label:    "Sound off",
    sticker_launcher_label: "Open stickers",
    sticker_gg:         "GG",
    sticker_nice:       "Nice",
    sticker_thinking:   "Hmm",
    sticker_oops:       "Oops",
    sticker_sweat:      "Uh oh",
    sticker_boom:       "Boom",
    sticker_taunt:      "Laugh",
    sticker_cry:        "Nooo",
    sticker_clap:       "Clap",
    sticker_trophy:     "GG EZ",

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
    error_name_reserved:  "That name is reserved for the AI. Please choose another.",
    error_generic:        "An unexpected error occurred.",
    error_title_full:     "Game in progress",
    error_title_finished: "Game ended",
    error_title_generic:  "Error",
    btn_new_room:         "New game",

    reconnecting:         "Reconnecting...",

    // Ranking
    ranking_btn_label:    "Ranking",
    ranking_top10_title:  "🏆 Top 10",
    ranking_top3_title:   "🏆 Top 3",
    ranking_you:          "(you)",
    ranking_your_position:"Your position",
    ranking_points_label: "points",
    ranking_wins_label:   "wins",
    ranking_close_label:  "Close",
    ranking_empty:        "No ranking yet.",
  },
};
