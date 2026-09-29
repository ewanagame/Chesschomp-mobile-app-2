export type RootStackParamList = {
  Home: undefined;
  Settings: { scrollTo?: 'savingGames' } | undefined;
  BoardFeatures: undefined;
  FreeBoardModes: undefined;
  Licenses: undefined;
  Bots: undefined;
  BotDetail: { botId: string };
  SavedGames: undefined;
  GameReviewSetup: undefined;
  GameReview:
    | { source: 'saved'; gameId: string }
    | { source: 'pgn'; pgn: string }
    | { source: 'fen'; fen: string };
  Board:
    | { mode: 'free'; resume?: boolean; passAndPlay?: boolean }
    | { mode: 'bot'; botId: string; resume?: boolean };
};
