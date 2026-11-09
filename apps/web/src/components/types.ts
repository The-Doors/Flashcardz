export type FlashcardSet = {
  id: number | string;
  name: string;
  cardCount: number;
  lastWorkedOn: string;
  /** Missing or null when the set has never been studied. */
  lastStudiedAt?: string | null;
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

export type AuthMode = "signin" | "signup" | "username";
export type SignInPayload = { email: string; password: string };
export type SignUpPayload = { username: string; email: string; password: string };

export type CommunitySort = "popular" | "newest" | "cards";

export type CommunitySet = {
  id: number | string;
  name: string;
  description?: string;
  cardCount: number;
  studyCount: number;
  author: string;
};

export type GroupMember = {
  id: number | string;
  name: string;
  avatarUrl?: string;
};

export type SharedGroupSet = {
  id: number | string;
  name: string;
  cardCount: number;
  sharedBy: string;
  createdAt: string;
};

export type StudyGroup = {
  id: number | string;
  name: string;
  description: string;
  category: string;
  memberCount: number;
  isMember: boolean;
  members: GroupMember[];
  sharedSets: SharedGroupSet[];
};