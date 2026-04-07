This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Review Coach V1 API

Use this endpoint to analyze recent reviews and get:

- top recurring issues to fix first
- prioritized reviews that need owner replies now
- draft public replies (Gemini-enhanced when configured)

`POST /api/review-coach`

Example request body:

```json
{
	"propertyName": "Pine Ridge RV Resort",
	"tone": "friendly",
	"reviews": [
		{
			"id": "r-1",
			"rating": 2,
			"text": "Bathrooms were dirty and wifi was unreliable.",
			"createdAt": "2026-04-01T10:00:00.000Z",
			"hasOwnerReply": false
		},
		{
			"id": "r-2",
			"rating": 5,
			"text": "Great staff and easy check-in.",
			"hasOwnerReply": false
		}
	]
}
```

Enable better reply phrasing by setting `GEMINI_API_KEY` (and optional `GEMINI_MODEL`).

## Review Coach V1 UI

Open `/review-coach` in the app to use the full in-app workflow:

- paste a JSON array of your real reviews
- run analysis
- copy draft replies
- prioritize recurring issues by frequency

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
