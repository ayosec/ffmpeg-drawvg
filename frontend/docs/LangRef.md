# Language Reference

This document is a draft to describe the language used by the drawvg filter. If
the filter is accepted into FFmpeg, please refer to the official documentation in
<https://ffmpeg.org/documentation.html>.

Internally, the language is known as VGS (*Vector Graphics Script*). In this
document, the term *drawvg* always refers to the programming language used by
the filter.

### Introduction

drawvg (*draw vector graphics*) is a language to draw two-dimensional graphics
on top of video frames. It is not intended to be used as a general-purpose
language. Since its scope is limited, it prioritizes being concise and easy
to use.

For example, using the [Canvas API] we can render a triangle running this code
in a Web browser:

[Canvas API]: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

```javascript
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

ctx.beginPath();
ctx.moveTo(125, 50);
ctx.lineTo(100, 100);
ctx.lineTo(150, 100);
ctx.closePath();
ctx.stroke();
```

The same triangle can be written with this drawvg script:

```vgs
moveto 125 50
lineto 100 100 150 100
closepath
stroke
```

It can be shortened using the aliases for `moveto`, `lineto`, and `closepath`:

```vgs,ignore
M 125 50
L 100 100 150 100
Z
stroke
```

Both newlines (`U+000A`) and spaces (`U+0020`) can be used interchangeably as
delimiters, so multiple commands can appear on the same line:

```vgs,ignore
M 125 50 L 100 100 150 100 Z
stroke
```

Finally, drawvg can use [!ffmpeg-expr] and frame metadata in command arguments.
In this example, we are using the variables `w` (frame width) and <code>h</code>
(frame height) to create a circle in the middle of the frame.

```vgs
circle (w / 2) (h / 2) (w / 3)
stroke
```

Many commands are a direct equivalent to a function in the [Cairo graphics
library](https://www.cairographics.org/). For such commands, the reference below
provides a link to the related Cairo documentation.

## Syntax

The syntax is heavily inspired by languages like [Magick Vector Graphics][MGV],
or [!svg-path]. Many command names are taken from [PostScript].

[!svg-path]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/path "SVG's `<path>`"
[MGV]: https://imagemagick.org/script/magick-vector-graphics.php
[PostScript]: https://en.wikipedia.org/wiki/PostScript

### Structure

A drawvg script consists of a series of commands to describe 2D graphics.

A command is an identifier (like `setcolor` or `lineto`) followed by its
arguments. Each item in the code (command name, arguments, etc.) is separated
by any of the following characters:

| Name    | C Syntax | Unicode  |
|---------|----------|----------|
| Space   | `' '`    | `U+0020` |
| Comma   | `','`    | `U+002C` |
| Newline | `'\n'`   | `U+000A` |
| Tabs    | `'\t'`   | `U+0009` |
| Return  | `'\r'`   | `U+000D` |

The beginning of the item indicates how it will be interpreted:

| Start                 | Item Type                        |
|-----------------------|----------------------------------|
| `//`                  | Comment                          |
| `0`, …, `9`, `+`, `-` | Number literal                   |
| `(`                   | Expression                       |
| `{`, `}`              | Block delimiters                 |
| Anything else         | Name of a command, a color, etc. |

### Comments

Comments start with two slashes (`//`), and stop at the end of the line (either
a `\n`, or the end of the script).

```vgs,ignore
circle 100 100 50 // this is ignored
fill

// this is also ignored
```

`//` must appear after a space, or at the beginning of the line. If `//` is
preceded by any non-blank character, the parser will consider `//` as part of
the previous item.

For example, in this script:

```vgs,ignore,error[1:14:4]
circle 10 10 50// something
```

The parser throws an error because it tries to parse `50//` as a number literal.


### Commands

The way commands are parsed is inspired by [!svg-path]:

* Every command in the script starts with its name, and it is followed by
  zero or more arguments.
* There are no explicit delimiters between commands or arguments.

    Most programming languages expect characters like parenthesis, commas, or
    semicolons, to separate items. For example:

    ```javascript
    moveto(10, 10); lineto(20, 30);
    ```

    The equivalent in drawvg is:

    ```vgs,ignore
    moveto 10 10 lineto 20 30
    ```

* If the command has no arguments (like `closepath` or `stroke`), the next
  command starts at the next item.

::: {.example}

In the next script there are 4 different commands:

```vgs,ignore
newpath rect 10 20 30 40 setcolor teal fill
```

1. `newpath` requires no arguments.
2. `rect` requires 4 arguments, so it takes the next 4 numbers.
3. `setcolor` requires 1 argument, so it takes the word `teal`.
4. `fill` requires no arguments.

:::

#### Single-Letter Aliases

Most commands in [!svg-path] are also present in drawvg. For some of them, there
is an alias to a longer name:

* `rcurveto` to `c` .
* `curveto` to `C`.
* `rlineto` to `l`.
* `lineto` to `L`.
* `rmoveto` to `m`.
* `moveto` to `M`.
* `closepath` to `Z`, `z` .

Other commands only exist in a single-letter form:

* `H`, `h`
* `Q`, `q`
* `S`, `s`
* `V`, `v`
* `T`, `t`

#### <a name="implicit-commands"></a>Implicit Commands

For many commands, the name can be omitted when it is used multiple times in
successive calls.

In the reference below, these commands has a *Can be Implicit* note in their
signature.

::: {.example}

For example, in this script:

```vgs
M 50 50
l 10 10
l 10 -10
l 10 10
l 10 -10
l 10 10
stroke
```

After the first call to `l` (alias to `rlineto`), the command can be executed
without the name, so it can be written as:

```vgs
M 50 50
l 10 10 10 -10 10 10 10 -10 10 10
stroke
```

:::

To reuse the same command (`l`, in the previous example), the parser checks if
the item after the last argument is a numeric value, like a number literal or a
FFmpeg expression.

::: {.example}

In this example:

```vgs,ignore
l 10 20 30 40 stroke
```

`l` requires 2 arguments, and can be implicit, so the parser performs this
operation:

1. Takes the two next items (`10` and `20`) and emits the first instruction.
2. Checks if the item after `20` is a numeric value. Since it is `30`, it
   takes `30` and `40` and emits the second instruction (`l 30 40`).
3. Checks if the next item after `40` is a numeric value, but it is a command
   (`stroke`), so it stops reusing `l`.


:::

This is another feature taken from [!svg-path]. An important difference with
SVG is that the separator between items is always required. In SVG, it can be
omitted in some cases. For example, the expression `m1-2` is equivalent to
`m 1 -2` in SVG, but a syntax error in drawvg.


### Arguments

Most commands expect numeric arguments, like number literals, variable names, or
expressions.

`setcolor` and `colorstop` expect a color.

`setlinecap` and `setlinejoin` expect a constant value.

#### Number Literals

A number literal is an item in the script that represent a constant value. Any
item that starts with a decimal digit (between `0` and `9`), a `-` or a `+`, is
interpreted as a number literal.

The value is parsed with [`av_strtod`]. It supports the prefix `0x` to write a
value with hexadecimal digits, and [many units][ffmpeg-units] (like `K` or `GiB`).

[`av_strtod`]: https://ffmpeg.org/doxygen/trunk/eval_8c.html#a7d21905c92ee5af0bb529d2daf8cb7c3
[ffmpeg-units]: https://ffmpeg.org/ffmpeg-utils.html#:~:text=The%20evaluator%20also%20recognizes%20the%20International%20System%20unit%20prefixes

In the next example, all literals represent the same value:

```vgs,ignore
10000
1e4
10K
0x2710
```

#### Expressions

[!ffmpeg-expr] can be used as arguments for any command that expects a numeric
argument. The expression must be enclosed in parenthesis.

::: {.example}

The variables `w` and <code>h</code> represent the width and height of the
frame. We can compute the center of the frame by dividing them by `2`:

```vgs,ignore
M (w / 2) (h / 2)
```

They can also contain parenthesis (to group operations, to call functions, etc):

```vgs,ignore
moveto
    ((w + 10) / 2)      // x
    (h / (2 * cos(t)))  // y
```

:::

The variables `n` and <code>t</code> can be used to compute a value that changes
over time.

::: {.example}

To draw a circle oscillating from left to right, we can use an expression
based on `sin(t)` for the `x` coordinate:

```vgs,loop[10]
circle
    (w / 2 + sin(2 * t) * w / 4)  // x
    (h / 2)                       // y
    (w / 5)                       // radius

stroke
```

:::

Expressions can be split in multiple lines, but they can't contain comments
within them.

```vgs,ignore,error[2:10:49]
moveto   // This is a comment.
    (w   // This is part of the expression, not a comment.
     + h)

```

#### Variable Names

When an expression is only a reference to a variable, the parenthesis can be
omitted, and the item is just the variable name.

::: {.example}

The next 3 expressions are equivalent: in all cases, they create a rectangle
covering the whole frame.

```vgs,ignore
rect (0) (0) (w) (h)

rect 0 0 w h

rect (0) 0 (w) h
```

:::

It is possible to create a variable with the same name of a command, and then
use it as an argument. In the previous example, <code>h</code> is both a
variable (frame height) and a command (`h`).

For [implicit commands], the parser prioritizes commands over variable names
when it has to determine if the command is reused.

::: {.example}

In this example, the variable <code>c</code> is used as the first argument in
two calls to `l`. Only the first one is valid, because in the second one, the
parsers tries to create a call to the `c` command.

```vgs,ignore,error[2:8:1]
setvar c 5
l c 10 c 15
```

This issue can be fixed by surrounding the start of the second call with
parenthesis:

```vgs,ignore,mark[2:8:3]
setvar c 5
l c 10 (c) 15
```

:::

#### Colors

The color to fill and stroke paths can be set with `setcolor`. Its argument has
the same syntax for colors in FFmpeg:

* A [color name recognized][ffmpeg-colors].
* In `#RRGGBB` format.
* Optionally, a `@a` suffix can be added to set the alpha value, where `a`
  is a number between `0` and `1`.

[ffmpeg-colors]: https://ffmpeg.org/ffmpeg-utils.html#Color

The color can be a variable name. In that case, its value is interpreted as a
`0xRRGGBBAA` code.

::: {.example}

```vgs
circle 75 100 50 setcolor #FF0000 fill

setvar CustomGreen 0x90EEAAFF
circle 125 100 50 setcolor CustomGreen fill

circle 175 100 50 setcolor blue@0.5 fill
```

:::

The commands `setrgba` and `sethsla` allow setting colors using expressions.

`defrgba` and `defhsla` compute the color and store it in a variable.

#### Constants

The argument for `setlinecap` and `setlinejoin` is an identifier referring to a
constant value.

```vgs,ignore
setlinecap round
```

## Guide

### Paths

A path is a complex shape, composed by lines and curves, that can be used to
fill a region, to stroke an outline, or to establish a clip region.

In order to draw anything on top of a video frame, we have to define a path, and
then use `stroke` or `fill`.

The [tutorial on paths in MDN][mdn-paths] is a good introduction to the topic.
It is focused on [!svg-path], but the same concepts can be applied in drawvg.

[mdn-paths]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths

#### <a name="current-point"></a>Current Point

Some commands require a *current point*. Initially, the *current point* is set
to [`NaN`][nan]. It is initialized with `M` or `moveto`. Other commands, like
`lineto` or `curveto`, updates the *current point* to the new end of the shape.

[nan]: https://en.wikipedia.org/wiki/NaN

The *current point* can be cleared with `newpath`. Commands that clear the path,
like `stroke` or `fill`, also clear the *current point*.

::: {.example}

`rlineto` uses coordinates relative to the *current point*.

Given this script:

```vgs
moveto 20 100
rlineto 150 -90
rlineto -50 200
closepath
stroke
```

These are the coordinates of the *current point* after executing each command:

| Command                | Current Point |
|------------------------|---------------|
| `moveto 20 100`        | `20, 100`     |
| `rlineto 150 -90`      | `170, 10`     |
| `rlineto -10 50`       | `140, 210`    |
| <code>closepath</code> | `20, 100`     |

The same script can be written with single-letter aliases:

```vgs,ignore
M 20 100 l 150 -90 -50 200 z stroke
```

:::

#### Defining a Shape

A path is defined by adding lines, curves, or basic shapes.

* Basic shapes
    * `circle`
    * `ellipse`
    * `rect`
    * `roundedrect`
* Lines
    * `M`, `moveto`
    * `m`, `rmoveto`
    * `H`, `h`
    * `V`, `v`
    * `L`, `lineto`
    * `l`, `rlineto`
    * `Z`, `z`, `closepath`
* Curves
    * `arc`, `arcn`
    * `C`, `curveto`,
    * `c`, `rcurveto`
    * `Q`, `q`
    * `S`, `s`
    * `T`, `t`

Single-letter commands are taken from [!svg-path].

#### Fill

The region within the shape defined by a path can be filled with `fill` or
`eofill`. Each command uses a different [fill rule][fill-rules]:

* `fill` uses the [winding rule][rule-winding], also known as
  [nonzero rule](https://en.wikipedia.org/wiki/Nonzero-rule).
* `eofill` uses the [even–odd rule][rule-even-odd].

[fill-rules]: https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-fill-rule-t
[rule-winding]: https://www.cairographics.org/manual/cairo-cairo-t.html#CAIRO-FILL-RULE-WINDING:CAPS
[rule-even-odd]: https://www.cairographics.org/manual/cairo-cairo-t.html#CAIRO-FILL-RULE-EVEN-ODD:CAPS

::: {.example}

This script shows the difference between the [winding][rule-winding] and
[even–odd][rule-even-odd] rules:

```vgs
rect 50 10 100 60
circle 150 70 40
setcolor seagreen
fill

rect 50 130 100 60
circle 150 190 40
setcolor skyblue
eofill
```

:::

#### Stroke

`stroke` draws a line around the shape defined by the path. The stroke can be
configured with different commands:

* `setdash`
* `setdashoffset`
* `setlinecap`
* `setlinejoin`
* `setlinewidth`
* `resetdash`

::: {.example}

This example use `setdashoffset` to animate the stroke:

```vgs,loop[10]
moveto 0 0
lineto w h

setlinecap round
setdash 50 50
setlinewidth 20
setdashoffset (hypot(w, h) * t / -3)
setcolor seagreen

stroke
```

:::

#### Clip

A [clip region](https://en.wikipedia.org/wiki/Clipping_(computer_graphics)) can
be established with `clip` and `eofill`.

If there is an active clip region, the new clip region will be the intersection
between the existing one and the path. `resetclip` reset the clip region to the
whole frame.

`eoclip` uses the [even–odd rule][rule-even-odd] to compute the clip region.

::: {.example}

```vgs
rect 50 50 100 200
clip

circle 30 30 150
setcolor seagreen
fill

// Draw outside the clip region.
resetclip
circle 30 30 150
setlinewidth 3
setcolor skyblue
stroke
```

:::

#### Preserving Paths

The path is cleared after any operation on it, like `fill` or `stroke`. To reuse
the same path in multiple operations, `preserve` must be called before them.

::: {.example}

In this example, each path is used twice.

```vgs
circle 120 120 50
setcolor seagreen
preserve stroke
clip

circle 100 100 50
setcolor skyblue
preserve fill
setcolor tomato
stroke
```

:::

### Variables

A drawvg can use some variables, provided by the interpreter, to compute values
in [!ffmpeg-expr]:

| Variable       | Description                          |
|----------------|--------------------------------------|
| `cx`           | X coordinate of the [current point]. |
| `cy`           | Y coordinate of the [current point]. |
| `w`            | Width, in pixels, of the frame.      |
| <code>h</code> | Height, in pixels, of the frame.     |
| `i`            | The loop counter in `repeat` blocks. |
| `n`            | Frame number.                        |
| <code>t</code> | Timestamp, in seconds.               |
| `duration`     | Duration, in seconds, of the frame.  |

#### User Variables

New variables can be created with the `setvar` command. It associates a name
with a numeric value.

The name must follow these rules:

* It must start with an ASCII letter.
* It can contain only ASCII letters and digits.
* It must not match the name of a variable provided by the interpreter (like `w` or <code>t</code>).

The same variable can be assigned multiple times.

::: {.example}

In this example, the result of an expression is stored in a variable with the
name `progress`. Then, it is used for the `x` and `width` arguments of `rect`.

```vgs,loop[2]
setvar progress (w * (pow(mod(t / 2 + 0.5, 1), 2.5)))

rect ((w - progress) / 2) 0 progress h

setcolor darkblue
fill
```

:::

Currently, a script can contain only 10 different variable names, but this
limit can be modified in the future.


### Colors

The pattern for fill/stroke operations can be either a solid color or a
gradient.

* Solid colors.
    * `setcolor`
    * `sethsla`
    * `setrgba`
* Gradients.
    * `lineargrad`
    * `radialgrad`

The pattern is not cleared after used in a fill/stroke operation.

#### Gradients

To configure a gradient, first call to `lineargrad` or `radialgrad`, and then
add color stops by calling `colorstop` for each stop.

::: {.example}

In this example, the whole frame is filled with a linear gradient:

```vgs
lineargrad 0 0 w h
colorstop 0 skyblue
colorstop 1 darkblue

rect 0 0 w h
fill
```

In this example, a radial gradient is used to simulate a sphere:

```vgs
radialgrad 90 90 5 120 120 100
colorstop 0.0 #90DDFF
colorstop 0.9 #000030
colorstop 1.0 #000000

rect 0 0 w h
fill
```

:::

#### Variables

`setcolor` and `colorstop` accept a variable name as the argument. When a
variable is used, its value is interpreted as a `0xRRGGBBAA` code.

::: {.example}

```vgs
// Use color #1020FF, alpha = 50%
setvar someblue 0x1020FF7F

setcolor someblue
rect 30 30 120 120
fill

rect 90 90 120 120
fill
```

:::

If a variable has the same name of a [FFmpeg color][ffmpeg-colors], the variable
has preference, and will be used instead of the predefined color.

::: {.example}

```vgs,nocolorwords
setcolor teal
rect 30 30 120 120
fill

setvar teal 0x70AAAAFF  // Now, `teal` is #70AAAA
setcolor teal
rect 90 90 120 120
fill
```

:::

`defrgba` and `defhsla` compute the `0xRRGGBBAA` value for a color given its
color components, either in sRGB or HSL color spaces.

Each color component must be in range `0` to `1`, except *hue*, which is `0` to
`360`.

::: {.example}

```vgs
defrgba colorA 1 0.5 0.25 1     // colorA = RGB(255, 127, 63)
defhsla colorB 200 0.75 0.25 1  // colorB = HSL(200, 75%, 25%)

rect 0 0 (w / 2) h
setcolor colorA
fill

rect (w / 2) 0 (w / 2) h
setcolor colorB
fill
```

:::

### Transformations

The coordinates for each command can be scaled, rotated, and translate, by using
the following commands:

* `rotate`
* `scale`
* `scalexy`
* `translate`

The transformation is applied when the command is executed. They have no effect
on the existing path, only on the next operations.

::: {.example}

```vgs
save

// Map (0, 0) as the center of the frame.
translate (w / 2) (h / 2)

// Scale the space as if the frame is 1x1 pixel.
scalexy w h

// Draw 3 lines with the same arguments,
// but each one on a different rotation.
M -0.25 0 H 0.25

rotate (PI / 4)
M -0.25 0 H 0.25

rotate (PI / 2)
M -0.25 0 H 0.25

// Restore before stroke, so the scale
// does not affect line width.
restore
stroke
```

:::

The transformations are done by updating the
[current transformation matrix](https://www.cairographics.org/manual/cairo-Transformations.html).

### State Stack

The state of a drawvg script contains all parameters used for drawing
operations, like the current color, the transformation matrix, the stroke
configuration, etc.

The `save` command pushes a snapshot of the state to an internal stack. Later,
`restore` pops the latest state from the stack, and uses that snapshot as the
new state.

The parameters that can be saved and restored are:

* Pattern for stroke and fill operations.
    * `lineargrad`
    * `radialgrad`
    * `setrgba`
    * `setcolor`
    * `sethsla`
* Transformation matrix.
    * `rotate`
    * `scale`
    * `scalexy`
    * `translate`
* Stroke configuration.
    * `setdash`
    * `setdashoffset`
    * `setlinecap`
    * `setlinejoin`
    * `setlinewidth`
* Clip region
    * `clip`

### Frame Metadata

Some FFmpeg filters add metadata to frames. The command `getmetadata` can read
metadata items containing a numeric value, and store it in a variable that can
be used for command arguments.

::: {.example}

The `cropdetect` filter computes the parameters to remove empty regions around
the video. These parameters are accessible in the `lavfi.cropdetect` keys of the
frame metadata.

```vgs,ignore
// Get metadata from cropdetect filter and store it
// in `cd*` variables.
getmetadata cdx lavfi.cropdetect.x
getmetadata cdy lavfi.cropdetect.y
getmetadata cdw lavfi.cropdetect.w
getmetadata cdh lavfi.cropdetect.h

rect cdx cdy cdw cdh
setcolor yellow@0.5
setlinewidth 10
stroke
```

To test the script, copy it to a `drawcropdetect.vgs` file, and then execute a
command like this:

```bash
ffplay -i example-video.webm -vf 'cropdetect, drawvg=file=drawcropdetect.vgs'
```

:::

### `if` / `repeat` Statements

There is limited support for control flow statements: only `if` and `repeat`.

Both commands receive two arguments: an expression and a block.

```vgs,ignore
if (condition) {
    // commands
}

repeat (count) {
    // commands
}
```

`if` executes its block if the result of `(condition)` is not zero.

`repeat` executes its block the number of times specified by `(count)`. In each
iteration, the variable `i` is used as a [loop counter].

If the result of the expression is not a finite number (like [`NaN`][nan]) the
block is not executed.

[loop counter]: https://en.wikipedia.org/wiki/For_loop#Loop_counters

#### Comparison and Logical Operators

[!ffmpeg-expr] only supports arithmetic operators (like `+` for addition).
Comparison operators (like `!=`) are supported via functions, while logical
operators (like `&&` for `AND`) can be emulated with arithmetic operations.

| Expression  | FFmpeg Equivalent  |
|-------------|--------------------|
| `x = y`     | `eq(x, y)`         |
| `x < y`     | `lt(x, y)`         |
| `x > y`     | `gt(x, y)`         |
| `x ≤ y`     | `lte(x, y)`        |
| `x ≥ y`     | `gte(x, y)`        |
| `a ≤ x ≤ b` | `between(x, a, b)` |

Logical operators can be emulated with multiplication (for `AND`), or addition
(for `OR`):

| Expression | FFmpeg Equivalent |
|------------|-------------------|
| `x OR y`   | `x + y`           |
| `x AND y`  | `x * y`           |

::: {.example}

In other programming languages, a code like this:

```javascript
if (x > y && z != 1) {
    // …
}
```

Can be written for drawvg like this:

```vgs,ignore
if (gt(x, y) * not(eq(z, 1))) {
    // …
}
```
:::

#### Early Exit

`break` causes a `repeat` loop to be terminated immediately.

If it is executed outside a `repeat` block, it terminates the whole script.

::: {.example}

In this example, we are using the [`randomg`](#randomg) function to draw a line
with random segments.

The loop can be executed `500` times, but it is interrupted if the X coordinate
of the [current point] (`cx`) exceeds the frame width (`w`). The [current point]
is updated after each call to `rlineto`.

```vgs
moveto 0 0

repeat 500 {
    rlineto
        (randomg(0) * 15)
        (randomg(0) * 20)

    if (gt(cx, w)) {
        break
    }
}

stroke
```

:::

### Procedures

Procedures associate a name with a block that can be called later. Its main
purpose is to reuse a group of commands in different places of a script.

A procedure can have zero, one, or two arguments. They can be defined with
`proc`, `proc1`, or `proc2`, depending on how many arguments are wanted.

```vgs,ignore
proc p0 {
    // …
}

proc1 p1 arg1 {
    // …
}

proc1 p1 arg1 arg2 {
    // …
}
```

Depending on the number of arguments, they can be called with `call`, `call1`,
or `call2`.

```vgs,ignore
call p0

call1 p1 (value1)

call2 p2 (value1) (value2)
```

The arguments (like `arg1` in the previous example) are stored as regular
variables.

When the procedure returns, the value of the variable for each argument is
restored to the value before calling the procedure. Changes in other variables
(with `setvar`, `getmetadata`, `defhsla`, and `defrgba`) are preserved.

`break` causes the script to leave the current procedure, if called outside a
`repeat` loop, similar to the [`return` statement][return-stm] in other
programming languages.

[return-stm]: https://en.wikipedia.org/wiki/Return_statement

::: {.example}

In this example, the procedure `zigzag` draws multiple lines from the
[current point].

```vgs
setvar len (w / 10)
setlinewidth 5

proc zigzag {
    repeat 10 {
        l len len len (-len)
    }

    stroke
}

setcolor #40C0FF
M 0 60
call zigzag

setcolor #00AABB
M 0 120
call zigzag

setcolor #20F0B7
M 0 180
call zigzag
```

The color and the Y coordinate of the starting point can be sent as procedure
arguments:

```vgs
setvar len (w / 10)
setlinewidth 5

proc2 zigzag color y {
    setcolor color

    M 0 y
    repeat 10 {
        l len len len (-len)
    }

    stroke
}

call2 zigzag 0x40C0FFFF 60
call2 zigzag 0x00AABBFF 120
call2 zigzag 0x20F0B7FF 180
```

:::

### Functions in Expressions

There are some functions specific to drawvg available in [!ffmpeg-expr].

#### Function `pathlen`

`pathlen(n)` computes the length of the current path, by adding the length of
each line segment returned by [`cairo_copy_path_flat`].

The function expects an argument `n`, as the maximum number of line segments to
add to the length, or `0` to add all segments.

[`cairo_copy_path_flat`]: https://www.cairographics.org/manual/cairo-Paths.html#cairo-copy-path-flat

::: {.example}

In this example, `pathlen` is used to animate the stroke of a spiral, in a 5
seconds loop.

```vgs,loop[10]
M (w / 2) (h / 2)

setvar a -1
repeat 16 {
    rcurveto
        (a * 2 / 3) 0
        (a * 2 / 3) (a)
        0 (a)

    setvar a (-sgn(a) * (abs(a) + 10))
}

setlinewidth 3
setdash
    (pathlen(0) * (1 - mod(t / 5, 1)))
    1e6

setcolor teal
stroke
```

:::

#### <a name="randomg"></a>Function `randomg`

`randomg(idx)` is similar to the `random(idx)` function, available in
[!ffmpeg-expr], but its state is global to the frame, instead of specific to
each expression.

To understand the difference, we need to dive into how `random(idx)` works
inside a drawvg script.

First, each expression in FFmpeg has a set of 10 internal variables, which can
be written with `st(idx, value)`, and can be read with `ld(idx)`. `idx` is a
value between `0` and `9`. These variables are initialized to `0`.

When a drawvg script is parsed, each expression is compiled with
[`av_expr_parse`], from [libavutil](https://ffmpeg.org/libavutil.html), and
these compiled expressions are reused for every frame. The changes in the
internal variables (with `st(idx, value)`) are visible between frames, but they
are not shared between expressions.

[`av_expr_parse`]: https://ffmpeg.org/doxygen/7.0/eval_8h.html#ad3bf8f3330d1fd139de2ca156c313f34

::: {.example}

In this example, the expression for the X coordinate updates its internal
variable `0` in every frame:

```vgs,loop[10@30]
circle
    (st(0, mod(ld(0) + 15, w))) // X
    120                         // Y
    (ld(0) + 20)                // radius

fill
```

`st(idx, value)` returns the updated value, so it can be used as the result of
the expression.

The radius is not affected because its internal variable (from `ld(0)`) is
not updated by the other expression.

Also, note that this example is just to show how internal variables are kept
between frames. A better approach to create this animation is to use the
variables <code>n</code> or <code>t</code>:

```vgs,ignore
circle (mod(n * 15, w)) 120 20
fill
```

:::

The function `random(idx)` returns a [pseudorandom] value between `0` and `1`.
`idx` is the internal variable that is used both as the seed and to keep the
state of the number generator.

[pseudorandom]: https://en.wikipedia.org/wiki/Pseudorandom_number_generator

::: {.example}

The next example uses `random(0)` to generate a random value for the center of a
circle:

```vgs,loop[2@18]
circle
    (random(0) * w)
    (random(0) * h)
    10

fill
```

The circle in every frame is at a different position, but always on the diagonal
line of the frame. This happens because the values for the coordinates X and Y
are identical, since both number generators use the same seed.

To distribute the circles over the entire frame we need different seeds for each
expression. This can be achieved by writing a non-zero value (like `0xF0F0`) to
the internal variable of one of expressions, but only when its value is `0`:

```vgs,loop[2@18]
circle
    (random(0) * w)
    (st(0, if(ld(0), ld(0), 0xF0F0)); random(0) * h)
    10

fill
```

This approach is only useful if we need completely different positions in each
frame. In the next example, random values are used to distribute many circles
over the frame, but the position is fixed. The only change over time is the fill
color:

```vgs,loop[6]
repeat 20 {
    circle
        (st(0, i + 1e5); random(0) * w)
        (st(0, i + 1e10); random(0) * h)
        10
}

sethsla (t * 60) 0.5 0.5 1
preserve fill

setcolor black@0.5
setlinewidth 1
stroke
```

This is achieved by using a precomputed state before calling `random(0)`. The
variable <code>i</code>, updated by `repeat`, is needed to compute different
states in each iteration.

:::

The `randomg(idx)` function, which is specific to drawvg scripts, is similar to
`random(idx)`, but intended to solve the previous problems:

* All frames have the same seed.
* The state is shared between expressions.

The parameter `idx` has two functions:

* The last two bits are the index of an internal state, so it is possible to
  have 4 different number generators.
* The first call to `randomg` with a specific index will use the argument as the
  seed for the number generator in that index.

In a script like this:

```vgs,ignore
M (randomg(0xFF1)) (randomg(0xFF0))
l (randomg(0xAA1)) (randomg(0xFF0))
```

There are 4 calls to `randomg`:

1. The first call, with the argument `0xFF1`, uses the internal state at index
   `1` (because `0xFF1` modulo `4` is `1`).

   Since this is the first use of that index, the number generator is
   initialized with the seed `0xFF1`.

2. The second call has the same behaviour: it initializes the state at index `0`
   with the value `0xFF0`.

3. The third uses `0xAA1` uses index `1`. Since that state is already
   initialized, the rest of the `0xAA1` value is ignored, and it returns the
   next number after the `0xFF1` seed.

::: {.example}

This example renders a simple rain animation, moving lines from top to bottom.

`randomg` is used to distribute the lines over the frame, and to apply different
speeds to each one.

```vgs,loop[10]
rect 0 0 w h
setcolor midnightblue
fill

setcolor white

repeat 50 {
    setvar offset (t * (randomg(0) + 1))

    moveto
        (mod(randomg(0) + offset / 6, 1) * w)
        (mod(randomg(0) + offset, 1) * h)

    rlineto 6 36

    setlinewidth (randomg(1) / 2 + 0.2)
    stroke
}
```

:::

### Tracing with `print`

It is possible to trace the execution of a drawvg script by printing the
value of an expression, either with the `print` command, or with the
<code>print</code> function.

In both cases, the values are written to the FFmpeg log.

Printing expressions may have a noticeable impact on the performance, so it is
preferable to use it only when necessary.

#### Function <code>print</code>

The function `print(t)` writes the value of <code>t</code>. It also returns
<code>t</code>, so it can be used in the middle of another expression.

::: {.example}

Given a line line this:

```vgs,ignore
M (sin(2 * PI * t) * w) 0
```

We can see the values of `sin(2 * PI * t)` by surrounding it with a call to
`print()`:

```vgs,ignore,mark[1:4:5]
M (print(sin(2 * PI * t)) * w) 0
```

Executing this script with a 1 second / 8 FPS video shows the expected values for the
sine function.

```console
$ ffmpeg \
    -f lavfi \
    -i 'color=r=8:d=1, drawvg=M (print(sin(2 * PI * t)) * w) 0' \
    -f null /dev/null \
  |& grep 'Eval @'

[Eval @ 0x7f500f502d20] 0.000000
[Eval @ 0x7f4ff784b420] 0.707107
[Eval @ 0x7f4ff784ba20] 1.000000
[Eval @ 0x7f4ff784c020] 0.707107
[Eval @ 0x7f4ff784c620] 0.000000
[Eval @ 0x7f4ff784cc20] -0.707107
[Eval @ 0x7f4ff784d220] -1.000000
[Eval @ 0x7f4ff784d820] -0.707107
```

:::

#### Command `print`

The command `print` accepts an arbitrary number of arguments, and for each one
it writes:

* The source location (line and column).
* The source code of the expression.
* The result of evaluating the expression.

When there are multiple expressions, they are separated by the `|` character.

::: {.example}

The next script prints the position of the [current point] after the `l`
command:

```vgs,ignore
M 10 20
l 100 100
print cx cy
stroke
```

For each frame, it produces this output:

```console
[3:7] cx = 110.000000 | [3:10] cy = 120.000000
```

The next example prints the values of `random(0)`:


```console
$ ffmpeg \
    -f lavfi \
    -i 'color=r=8:d=1, drawvg=print (random(0))' \
    -f null /dev/null \
  |& grep 'drawvg @'

[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.229731
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.959813
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.071676
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.044600
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.134127
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.320513
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.857675
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.562456
```

:::

## Commands

### `arc`

```signature
arc cx cy radius angle1 angle2 **
```

TODO

### `arcn`

```signature
arcn cx cy radius angle1 angle2 **
```

### `break`

```signature
break
```

### `circle`

```signature
circle cx cy radius **
```

### `clip`

```signature
clip
```

### `eoclip`

```signature
eoclip
```

### `Z`, `z`, `closepath`

```signature
Z, z, closepath
```

### `colorstop`

```signature
colorstop offset color **
```

### `C`, `curveto`

```signature
C, curveto x1 y1 x2 y2 x y **
```

### `c`, `rcurveto`

```signature
c, rcurveto dx1 dy1 dx2 dy2 dx dy **
```

### `defhsla`

```signature
defhsla varname h s l a
```

### `defrgba`

```signature
defrgba varname r g b a
```

### `ellipse`

```signature
ellipse cx cy rx ry **
```

### `fill`

```signature
fill
```

### `eofill`

```signature
eofill
```

### `getmetadata`

```signature
getmetadata varname key
```

### `H`, `h`

```signature
H, h x **
```

### `if`

```signature
if condition { block }
```

### `lineargrad`

```signature
lineargrad x0 y0 x1 y1
```

### `L`, `lineto`

```signature
L, lineto x y **
```

### `l`, `rlineto`

```signature
l, rlineto dx dy **
```

TODO: line from [current point].

### `M`, `moveto`

```signature
M, moveto x y **
```

### `m`, `rmoveto`

```signature
m, rmoveto dx dy **
```

### `newpath`

```signature
newpath
```

### `preserve`

```signature
preserve
```

Indicates that the next operation to fill, stroke, or clip, must preserve the
path, so the same path can be used in multiple operations.

It has effect on these commands:

* `clip`
* `eoclip`
* `eofill`
* `fill`
* `stroke`

The script can contain any command between `preserve` and the associated
operation. This allows modifying other properties, like the current color.

::: {.example}

In this example, the same path is used for both `fill` and `stroke`, but with
different colors.

```vgs
circle (w / 2) (h / 2) (w / 3)

setlinewidth 10
setcolor skyblue
preserve fill

setcolor seagreen
stroke
```

:::

`preserve` can be called multiple times, if the same path has to be used in
3 or more operations.

::: {.example}

In this example, the path created by `circle` is used by `fill`, `stroke`, and
`clip`. After `clip`, the path is cleared.

```vgs,ignore
circle 100 100 50

preserve fill
preserve stroke
clip
```

:::


### `print`

```signature
print expr **
````

### `proc1`

```signature
proc1 name varname { block }
```

### `call1`

```signature
call1 name arg
```

### `proc2`

```signature
proc2 name varname1 varname2 { block }
```

### `call2`

```signature
call2 name arg1 arg2
```

### `proc`

```signature
proc name { block }
```

### `call`

```signature
call name
```

### `Q`, `q`

```signature
Q x1 y1 x y
```

### `radialgrad`

```signature
radialgrad cx0 cy0 radius0 cx1 cy1 radius1
```

### `rect`

```signature
rect x y width height
```

### `repeat`

```signature
repeat count { block }
```

### `resetclip`

```signature
resetclip
```

### `resetdash`

```signature
resetdash
```

### `restore`

```signature
restore
```

### `rotate`

```signature
rotate angle
```

### `roundedrect`

```signature
roundedrect x y width height radius **
```

### `save`

```signature
save
```

### `scale`

```signature
scale s
```

### `scalexy`

```signature
scalexy sx sy
```

### `setcolor`

```signature
setcolor color
```

### `setdash`

```signature
setdash length **
```

### `setdashoffset`

```signature
setdashoffset offset
```

### `sethsla`

```signature
sethsla h s l a
```

### `setlinecap`

```signature
setlinecap cap
```

Set the current line cap style, which determines the shape used to draw the end
points of lines.

`cap` must be one of the following names:

* `butt`
* `round`
* `square`

It calls to
[`cairo_set_line_cap`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-set-line-cap)
to set the line cap style.

::: {.example}

This example draws 3 lines with the same length, each one with a different
line cap style:

```vgs
setlinewidth 40

setlinecap butt
setcolor tomato
M 60 40 v 100 stroke

setlinecap round
setcolor seagreen
M 120 40 v 100 stroke

setlinecap square
setcolor skyblue
M 180 40 v 100 stroke

M 20 40 H 220 m 0 100 H 20
setcolor black@0.5
setlinewidth 2
stroke
```

:::

### `setlinejoin`

```signature
setlinejoin join
```

Sets the current line join style, which determines the shape used to join two
line segments.

`join` must be one of the following names:

* `bevel`
* `miter`
* `round`

It calls to
[`cairo_set_line_join`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-set-line-join)
to set the line join style.

::: {.example}

This example draws 3 lines with the same length, each one with a different
line join style:

```vgs
setlinewidth 30

setlinejoin bevel
setcolor tomato
M 70 20 l 50 50 50 -50 stroke

setlinejoin miter
setcolor seagreen
M 70 90 l 50 50 50 -50 stroke

setlinejoin round
setcolor skyblue
M 70 160 l 50 50 50 -50 stroke
```

:::

### `setlinewidth`

```signature
setlinewidth width
```

### `setrgba`

```signature
setrgba r g b a
```

### `setvar`

```signature
setvar varname value
```

### `stroke`

```signature
stroke
```

### `S`, `s`

```signature
S, s x2 y2 x y **
```

### `translate`

```signature
translate tx ty
```

### `T`, `t`

```signature
T, t x y **
```

### `V`, `v`

```signature
V, v x **
```



[!ffmpeg-expr]: https://ffmpeg.org/ffmpeg-utils.html#Expression-Evaluation "FFmpeg expressions"
[current point]: #current-point
[implicit commands]: #implicit-commands
