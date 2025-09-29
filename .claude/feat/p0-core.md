Core User Incentive Logic
- In a single week, 3 notes/journals will unlock a meditation session. 5 notes/journals are needed for a weekly report
- 10 notes are needed for a monthly report
- Key assumptions: 3-4 notes are good for a 5-min session; we want users to experience the 'meditation' sessions; 
- updates/fluorishes to progress bar (animation + sound) - like mario hitting sound (Sound found) -- GET DESIGNER
- modal for everytime user adds a journal or completes a meditation with animation.. progress bar also gets updated

Free vs Paid
- Free: Unlimited notes/journals, 1 meditation generation / week (3 entries), no weekly report 
- Paid: Unlimited notes/journals, unlimited meditation generation, weekly + monthly report + voice selection (v2)

Notifications - 3rd party (OneSignal)
1. Objective: Remind users to log journals/notes
- Before meditation unlocked 
-- (24h without any logging): [Generic] You are [X] journals away from unlocking your personalized AI meditation session. If you have some time today, create a little note to remember your day. 
- After meditation unlocked: 
-- (24h without any logging note): Life passes by and we sometimes forget the moments that matter. Spend 5s today recording an audio note for yourself, future you will thank you today [insert smiley emoji]
-- (24h without any meditation) (can keep triggering as long as 1st meditation is not complete): Just a gentle reminder that you have unlocked a personalized AI-generated meditation session which is currently unused. No rush! We will be here whenever when you find yourself in need of a quiet space for some reflection and inspiration.
-- (Subsequent meditation triggers): 

2. Objective: Tell users when meditation is complete
When meditation generation is complete: Your personalized meditation has been generated and waiting for you to dive right in. Just a gentle reminder that it will only be available for the next 24h.

3. Objective: Update users when reports are generated
When weekly/monthly report has been generated and sent to email..

Ensure apis can work at scale? 

Report Auto-generation
- Weekly report > Send every midnight on following Mon when conditions fulfilled
- Monthly report (Not started) > Send every midnight on following Mon when conditions fulfilled 

Saving meditations 
- Not necessary: generated meditation persist for one day, then auto-delete.
- Instead, show: notes selected, duration, short summary of meditation

## Auth / login
- Signin with google (DONE)
- Create new account page (DONE)
- Forget password flow and UI (DONE)
- Can delete user account, all user data permanently (DONE)
### Email SMTP Provider for auth-related emails (Resend)
