export type FlashcardSet = {
  id: number | string;
  name: string;
  cardCount: number;
  lastWorkedOn: string;
};

export type NavId =
  | "community"
  | "create"
  | "tutorial"
  | "groups"
  | "settings"
  | "home"
  | "profile";

export type UserInfo = {
  name?: string;
  email?: string;
  avatarUrl?: string;
};

/** { "YYYY-MM-DD": cardsStudied } */
export type ActivityData = Record<string, number>;

export type AuthMode = "signin" | "signup";
export type SignInPayload = { email: string; password: string };
export type SignUpPayload = { name: string; email: string; password: string };
