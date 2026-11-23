# Setting up Task Manager

This walks you through getting Task Manager ready to use: people to assign tasks to, default assignees, projects, calendars, saved filters, update links, and putting it on your iPad or phone.

The same steps are in the app under **Setup guide** (the compass button at the bottom of the sidebar, or **Settings → Setup guide**). There, each step ticks itself off once it's done.

Part 2 at the end covers the one-time technical setup (database, calendar feed, hosting). You only need it if you're setting up your own copy.

---

## Part 1: Using the app

### 1. Add the people you assign tasks to

1. Open **People**.
2. Press **Add person**.
3. Type their name. An email address is optional; with one, you can email them their task list.
4. Pick a color and press **Add person**.

People don't need an account. To edit someone, use the pencil on their card. To delete several at once, use **Select multiple** at the top of the page, tick them, then **Delete selected**.

Tap a person's card to see their open tasks. They're sorted by due date; tasks with no due date come last, highest priority first.

### 2. Choose who gets new tasks by default (optional)

- **For every project:** on **People**, use **Assigned to by default** at the top. Tick everyone who should be put on new tasks.
- **For one project:** open the project, press the pencil on its banner, untick **Use the workspace default**, then open the **Assigned to by default** dropdown and tick the people you want (you can pick several). Press **Done**, then **Save changes**.

### 3. Create a project

1. Press **+** next to **Projects** in the sidebar (on a phone: the **Projects** tab, then **New project**).
2. Give it a name and color. Optionally choose a category and a default priority.
3. Press **Create project**.

### 4. Add tasks with due dates

1. Press **New task** (or the **+** button on a phone).
2. Type the task and choose the project.
3. Under **Due**, tap **Today**, **Tomorrow** or **Pick date…**.
4. Open the task to add a time, a reminder, details, notes and subtasks.

Only tasks with a due date go to your calendar.

### 5. Connect Google Calendar or Outlook

Task Manager gives you a private calendar address. Google Calendar, Outlook and Apple Calendar subscribe to it and show your tasks with due dates as events. They stay up to date as you change tasks.

1. Go to **Settings → Calendars**.
2. Choose which tasks to show: **Every task with a due date**, or **Tasks assigned to** one person.
3. Press **Make calendar address**.
4. Press the button for your calendar:
   - **Add to Google Calendar**: Google Calendar opens and asks to add the calendar. Press **Add**.
   - **Add to Outlook.com**: for personal Outlook, Hotmail or Live accounts. Press **Import**.
   - **Add to Outlook (work or school)**: for Microsoft 365 accounts. Press **Import**.
   - **Apple Calendar**: on an iPad, iPhone or Mac, opens Calendar and asks to subscribe.

   If a button doesn't work, press **Copy address**, then paste it in by hand:
   - Google Calendar on a computer: **Other calendars → + → From URL**.
   - Outlook on the web: **Add calendar → Subscribe from web**.
   - Outlook for Windows: **Add calendar → From Internet**.

**Good to know**

- Tasks with a due time become 30-minute events. Tasks without a time show as all-day.
- Finished tasks stay on the calendar for 30 days, marked with ✓.
- Google checks for changes every 8 to 24 hours and Outlook every few hours. Neither lets you make it check sooner.
- The calendar is read-only. Change tasks in Task Manager, not in the calendar.
- Anyone with the address can see those tasks. Share it only with people you trust. **Turn off** stops it working at once.
- Times use the time zone of the device you made the address on.

**Just one task?** Open the task and use **Add to calendar** under **When**. That adds a one-time copy to Google Calendar, Outlook or Apple Calendar (as a .ics file). The copy doesn't change if you change the task later.

### 6. Save the filters you use often (optional)

1. On **All tasks** or in a project, set **Assigned to**, **Priority**, **Context**, **Group by** and **Sort by**.
2. Press **Save these filters** and give it a name.

Saved filters appear in the sidebar, so one tap opens that list. With more than three, they fold under a **Filters** heading. Tap it to open or close. Delete a saved filter with the × next to it under **Saved** on its page.

### 7. Let people update their own tasks (optional)

1. On **People**, tap a person.
2. Press **Update link**. It's copied for you.
3. Send it to them by text or email.

They can mark their tasks done and add notes, with no sign-in. Their changes show up in your tasks. Press **Turn off** to stop the link working.

### 8. Put it on your iPad or phone

1. Open the app's address in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Open it from the new icon. It runs full screen and stays signed in.

---

## Part 2: One-time technical setup

You only need this when setting up your own copy of the app, or after pulling changes that add database features.

### Database (Supabase)

The schema is in `supabase/migrations/`. Run any files that haven't been applied yet, in order. Use the Supabase dashboard's **SQL editor** or `supabase db push`.

Calendar feeds need `20261122120000_calendar_feeds.sql`. Until it's applied, Settings → Calendars shows an error when you make an address. Everything else works as before.

### Calendar feed function (Supabase Edge Function)

Calendar apps read the feed from `supabase/functions/calendar-feed`. Deploy it with JWT verification **off**, because calendar apps can't sign in; the private token in the address is the key:

```bash
supabase functions deploy calendar-feed --no-verify-jwt --project-ref <your-project-ref>
```

Or in the dashboard: **Edge Functions → Deploy a new function**, name it `calendar-feed`, paste in `index.ts`, and turn off **Enforce JWT verification**.

Optional: set a secret `APP_URL` (your app's address) and each calendar event gets an "Open in Task Manager" link:

```bash
supabase secrets set APP_URL=https://your-app.vercel.app --project-ref <your-project-ref>
```

### Sign-in addresses

In Supabase under **Authentication → URL Configuration**, the **Site URL** and **Redirect URLs** must list every address the app runs from, such as `http://localhost:5173` and your Vercel address.

### Hosting (Vercel)

The app is a static Vite build (`npm run build`, output in `dist/`). On Vercel, set these environment variables:

- `VITE_SUPABASE_URL`: your project's URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the publishable (anon) key

Leave `VITE_DEVICE_MODE` unset for the cloud version.
