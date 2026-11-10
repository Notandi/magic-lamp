# Magic Lamp

An interactive 3D toy: the player rubs a genie lamp with a hand that follows their mouse, smoke builds up, and a genie pours out to offer them Magic: The Gathering cards.

## Language

**Lamp**:
The brass genie lamp at the centre of the scene; the only thing the player can rub.
_Avoid_: Oil lamp, teapot

**Hand**:
The 3D hand that stands in for the player's cursor.
_Avoid_: Cursor, pointer

**Rub**:
The player holding the button down and moving the Hand back and forth across the Lamp's surface.
_Avoid_: Stroke, pet, polish

**Rub stroke**:
A single back-and-forth leg of a Rub, ended by a change of direction.
_Avoid_: Swipe, pass

**Charge**:
How much magic the Lamp has built up from Rubbing; when it is full, the Lamp releases Cards.
_Avoid_: Progress, energy, power

**Smoke**:
The magical vapour that rises from the Lamp's spout, growing as Charge grows.
_Avoid_: Mist, fog, particles

**Wish**:
The Lamp releasing a set of Cards when Charge is full: the Genie pours out and offers them. Each Wish replaces the previous Wish's Cards.
_Avoid_: Pull, summon, drop, pack

**Genie**:
The spirit that pours out of the Lamp's spout when a Wish starts and offers the Wish's Cards with open arms. It hovers over the Lamp while the Cards are out and is drawn back in when they are cleared.
_Avoid_: Djinn, spirit, ghost

**Card**:
A real Magic: The Gathering card drawn at random from the game's whole history, shown as a thin 3D object with its face on the front and either the official card back or, for a double-faced card, its second face on the back. Tokens, art cards and emblems are not Cards.
_Avoid_: Tile, item

**Inspect**:
Bringing one Card up close to the camera so the player can read it; rubbing is paused while a Card is Inspected.
_Avoid_: Zoom, focus, select
