import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    '/',
    '/events/:id',
    // '/api/webhook/stripe',
    '/api/uploadthing',
    '/api/webhook/clerk', 
  ], 
  ignoredRoutes: [
    '/sign-in',
    '/api/uploadthing',
    '/api/webhook/clerk', 
  ]
});

export const config = {
  matcher: [
    '/((?!.+\\.[\\w]+$|_next).*)', 
    '/', 
    '/(api|trpc)(.*)',
    '/api/webhook/clerk',
  ],
};
