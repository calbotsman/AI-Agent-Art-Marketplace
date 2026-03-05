import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { verifyUserPassword } from './lib/queries';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Credentials({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }

        const user = await verifyUserPassword(email, password);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        (token as { userId?: string }).userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = (token as { userId?: string }).userId;
      if (session.user && userId) {
        (session.user as { id?: string }).id = userId;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
