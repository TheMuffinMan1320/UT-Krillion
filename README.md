# Longhorn Long Shot

A daily UT Austin trivia game where the rarer your answer, the higher you climb the Tower.

## How to play

- Each climb has 7 open-ended prompts, like "Name a UT residence hall."
- You get 30 seconds to type one answer per prompt.
- Every correct answer has a rarity tier. Obvious answers earn a little, deep-cut answers earn a lot:

  | Tier | Points |
  | --- | --- |
  | Freshman | 10 |
  | Sophomore | 25 |
  | Upperclassman | 50 |
  | Grad Student | 75 |
  | Hook 'em Legend | 100 |

- Your points fill the UT Tower on the left (700 points = all 307 ft, and the Tower lights up orange).
- **Daily climb:** everyone gets the same 7 prompts each day, once per day. Your streak and best score are saved in your browser.
- **Practice climb:** a random set of 7, play as often as you like.
- At the end you can copy an emoji summary to share.

## Run it

No build step or install. Open `index.html` in a browser:

```sh
open index.html            # macOS
```

Or serve the folder (handy for phones on the same Wi-Fi):

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

- `index.html` – page layout and screen templates
- `style.css` – burnt orange and limestone styling, light and dark mode
- `game.js` – game loop, timer, fuzzy answer matching, daily seed, scoring, share text
- `questions.js` – the question bank (17 prompts, ~270 accepted answers)

## Adding or editing questions

Each prompt in `questions.js` looks like this:

```js
{
  id: "dorms",
  category: "Campus",
  prompt: "Name a UT Austin residence hall.",
  answers: [
    { a: "Jester", alt: ["Jester West", "Jester East"], t: 1 },
    { a: "Whitis Court", alt: [], t: 5 },
  ],
}
```

`a` is the answer shown on the board, `alt` lists other spellings or nicknames that count, and `t` is the tier from 1 (obvious) to 5 (legendary). Matching ignores case, accents, punctuation and a leading "the", and forgives a small typo on longer answers.

Rarity tiers are hand-set guesses. Adjust them as you see what people actually answer.

---

A fan-made game. Not affiliated with The University of Texas at Austin.
