import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      isAdmin?: boolean;
      role?: string;
    };
    client?: {
      id: string;
      businessName: string;
      ownerName: string;
    };
    selectedClientId?: string;
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    isAdmin?: boolean;
    clientId?: string | null;
  }
}
