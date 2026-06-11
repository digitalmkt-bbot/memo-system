# Database

The schema is now managed by **Prisma** in `backend/prisma/schema.prisma`.
The atomic running-number function lives in `backend/prisma/functions.sql`
and is installed by the seed script (`backend/prisma/seed.ts`).

Apply everything locally with:

```bash
cd backend
npx prisma db push     # create tables from schema.prisma
npx prisma db seed     # install next_memo_no() + seed companies/departments/users
```

`schema.sql` in this folder is kept only as a plain-SQL reference of an
earlier iteration and is NOT used by the application.
