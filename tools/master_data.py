# The master tier's nine, in prose. Shared by master_build.py (the lesson
# page), master_cheatsheet.py (the crib) and master_gallery.py (the drill), so
# a technique is described in one place and the three pages cannot drift into
# three accounts of it.
#
# Fields:
#   id/anchor  matches SudokuMaster.LESSON in assets/js/master.js — the coach
#              links to master.html#<id>, so changing one means changing both
#   n          the number in the running order, continuing the Advanced nine
#   family     Uniqueness / Single digit / Chain — the same three the site uses
#   what       one sentence: the configuration
#   why        the argument. On this tier this is the important field: every
#              one of these is a proof you have to be able to reconstruct at
#              the board, or you will not trust it enough to delete anything
#   find       the scan that turns it up
#   kill       what it earns you
#   guard      how it lies to you
#   cost       the honest note on when it is worth reaching for

ORDER = ["unique-rectangle", "bug", "finned-fish", "kite", "empty-rectangle",
         "colouring", "w-wing", "xy-chain", "aic"]

TECH = {
    "unique-rectangle": dict(
        id="unique-rectangle", key="unique_rect", n="11", family="Uniqueness",
        title="Unique rectangle",
        what="Four cells at the corners of a rectangle, spanning exactly two boxes, all four able to take the same two digits.",
        why="""If all four corners held nothing but <b>A</b> and <b>B</b>, the two ways of filling
             them would both be legal: swap the diagonals and every row, column and box still
             reads the same. That is two solutions, and a published puzzle has one. So the
             position you are looking at cannot be that position &mdash; whatever it is that
             stops the swap has to be true.""",
        find="""Every time you write a bi-value pair, glance along its row and its column for the
             same pair again. Two matching pairs on one line is the trigger; then look at the
             two cells that finish the rectangle, and count the boxes.""",
        kill="""<b>Type 1</b> &mdash; three corners bare and the fourth carrying extras: the fourth
             loses both pair digits, which usually solves it outright. <b>Type 2</b> &mdash; all
             four bare but two of them carrying the same single extra: one of those two is that
             extra, so everything seeing both loses it.""",
        guard="""<b>Two boxes, not four.</b> Over four boxes the swap would leave a box short of a
             digit, so there is nothing deadly about it and no argument at all. Four corners
             reading the same pair across four boxes is the commonest false positive up here, and
             it looks exactly as convincing as the real thing.""",
        cost="""The only two techniques on the site that reason from the puzzle rather than from
             the grid. On a grid where you have already made a mistake they keep working and hand
             you a confident wrong answer, so the trainer refuses to offer either unless the
             digits currently on the board still lead to exactly one solution."""),

    "bug": dict(
        id="bug", key="bug", n="12", family="Uniqueness", title="BUG+1",
        what="Every unsolved cell is down to two candidates except one, which has three.",
        why="""A grid where every unsolved cell holds two candidates and every digit has exactly
             two homes in every unit is a <i>bivalue universal grave</i>: its solutions come in
             pairs, because you can flip every cell to its other candidate and still have a legal
             grid. One extra candidate is all that stands between the position in front of you
             and that grave. Take it away and the puzzle would have an even number of answers;
             it has one; so the extra candidate is the answer in its cell.""",
        find="""You do not hunt for this one &mdash; you notice it. Late in a hard puzzle, when
             the marks have thinned out to pairs everywhere, look for the single cell still
             carrying three.""",
        kill="A digit placed outright, which is rare enough on this tier to be worth the look.",
        guard="""Three candidates in one cell is not enough on its own. <b>Every other unsolved
             cell must hold exactly two</b>, and taking the digit out has to leave every digit
             with exactly two homes in every unit &mdash; a unit reading one, three, two has a
             hidden single in it and is nothing like a grave. The trainer checks the whole board
             before it offers this, and so should you.""",
        cost="""An endgame move, and it will not arrive twice in one puzzle. Worth knowing
             because when it does arrive it is instant, and because it is the clearest small
             proof in sudoku that uniqueness is information."""),

    "finned-fish": dict(
        id="finned-fish", key="finned", n="13", family="Single digit",
        title="Finned X-Wing",
        what="An X-Wing with one or two extra spots in a base line, all of them inside a single box.",
        why="""Either those extra spots are all false &mdash; in which case what is left is a
             plain X-Wing and its eliminations hold &mdash; or one of them is the digit. Both
             branches cost something: a cell that sits in the X-Wing's crossing lines <i>and</i>
             sees every fin loses the digit either way. Since the fins share a box, seeing all of
             them means being in that box.""",
        find="""This is the pattern you already half-found and threw away. Whenever a line has
             three spots instead of two, do not abandon the fish &mdash; ask whether the third
             spot sits in the same box as one of the corners. If it does, you have a move.""",
        kill="""The digit, from the crossing lines &mdash; but only inside the fin's box. That is
             usually one or two cells, and they are the cells the plain X-Wing would have killed
             anyway.""",
        guard="""<b>All the fins in one box.</b> Two leftover spots in different boxes and there
             is no cell that sees both, so nothing survives the second branch. Also check you
             have the right box: the eliminations are the intersection of the crossing lines with
             the fin's box, not the whole crossing line.""",
        cost="""The best value on this tier. It costs nothing extra to look for &mdash; you are
             already counting spots per line for the X-Wing &mdash; and it converts a scan that
             usually fails into one that often pays."""),

    "kite": dict(
        id="kite", key="kite", n="14", family="Single digit", title="2-string kite",
        what="A row and a column with exactly two spots each for one digit, whose near ends share a box.",
        why="""Each line is a strong link: one of its two spots is the digit. The two near ends
             sit in the same box, so they cannot both be it. Kill one and its line's other end
             becomes the digit; kill the other and the same happens on the other line. Whichever
             way it falls, <b>one of the two far ends is the digit</b> &mdash; so anything seeing
             both far ends cannot be.""",
        find="""Light one digit and write down every line with exactly two spots. Then look for a
             row and a column from that list with one spot each inside the same box. The far ends
             are the ones that do the work, and they are usually nowhere near each other.""",
        kill="The digit, from every cell that sees both far ends &mdash; often just one cell.",
        guard="""If the near ends share a <i>line</i> rather than a box, this is the skyscraper
             you already know. If the far ends also line up, it is an X-Wing. And if the near ends
             share nothing at all, there is no pattern here &mdash; two strong links that never
             meet prove nothing.""",
        cost="""The same scan as the skyscraper, one box-check further on. Learn them as one
             habit: two strong links, and the question is only where their ends meet."""),

    "empty-rectangle": dict(
        id="empty-rectangle", key="empty_rect", n="15", family="Single digit",
        title="Empty rectangle",
        what="A box whose spots for one digit all fall on one row and one column of it, joined to a strong link elsewhere.",
        why="""The box has to contain the digit somewhere, and everywhere it could go is on that
             row or that column: so <b>the box's digit is on one line or the other</b>. Now take
             a strong link on the same digit with one end on the box's row. If that end is the
             digit, the box cannot use its row and must use its column; if it is not, the link's
             far end is the digit. Either way the cell where the far end's line crosses the box's
             column is finished.""",
        find="""Light a digit and look at each box in turn with three or four spots left. Ask
             whether they fit an L &mdash; one row plus one column, leaving a 2&times;2 block of
             the box empty. That empty block is what the name is about. Then look along the row
             and the column for a line with exactly two spots.""",
        kill="One cell, almost always. It is a precise move rather than a broad one.",
        guard="""The box's spots must genuinely need both lines. All of them on one line is a
             pointing pair, which is cheaper and which you should have found already. And the
             link has to reach the box's row or column with its <i>near</i> end, outside the box
             itself.""",
        cost="""Fiddlier to see than the kite and worth it: empty rectangles are common, and this
             is the one master technique that reads a box rather than a line."""),

    "colouring": dict(
        id="colouring", key="colouring", n="16", family="Single digit",
        title="Simple colouring",
        what="Every strong link for one digit, followed at once and coloured in two alternating colours.",
        why="""Along a strong link exactly one end is the digit, so a chain of them alternates:
             true, false, true, false. Colour the alternation and one colour is entirely true and
             the other entirely false &mdash; you just do not know which. Two things follow.
             <b>If two cells of one colour share a unit</b>, that colour cannot be the true one,
             so every cell wearing it loses the digit. <b>If a cell outside the chain sees both
             colours</b>, it loses the digit whichever colour wins.""",
        find="""Pick a digit, find any line or box with exactly two spots, and start walking:
             from each end, look for another two-spot unit through it. Mark alternately as you
             go &mdash; on paper, circles and crosses. Four or five cells in you usually have
             your answer.""",
        kill="""Either an entire colour, which can be half a dozen candidates at once, or every
             cell that sees both colours. This is the widest-reaching move on the tier.""",
        guard="""Only ever chain through <b>strong</b> links &mdash; units with exactly two spots.
             A unit with three is not a link and will colour your grid into nonsense. If following
             the links round gives one cell both colours, stop: the position is already
             contradictory, which means an earlier elimination was wrong.""",
        cost="""The one to learn if you learn only one. The skyscraper, the kite and half the
             fish are special cases of it, and it costs a pencil rather than a new idea."""),

    "w-wing": dict(
        id="w-wing", key="w_wing", n="17", family="Chain", title="W-Wing",
        what="Two cells holding the same two candidates, joined by a strong link on one of them.",
        why="""Call the pair <b>A</b>/<b>B</b>, and let the link be on B, with one end seeing the
             first cell and the other end seeing the second. One of those two ends is a B. Say it
             is the one next to the first cell: then that cell cannot be B, so it is A. Say it is
             the other: then the second cell is A. <b>One of the pair is an A either way</b>, so
             anything seeing both of them cannot be.""",
        find="""Bi-value cells are already on your list. Look for the same pair twice, in cells
             that do <i>not</i> see each other &mdash; then ask whether some unit has exactly two
             spots for one of the two digits, positioned to reach both.""",
        kill="The other digit, from every cell seeing both of the matching pair.",
        guard="""The two cells must read <b>exactly</b> the same two digits, and must be strangers
             to each other. If they see each other you have a naked pair and should have used it
             already. And the link must be a real strong link on one of the pair's own digits.""",
        cost="""Cheap once bi-value cells are circled, and it reaches across the board in a way
             the XY-Wing cannot &mdash; the two cells never need to see anything of each other."""),

    "xy-chain": dict(
        id="xy-chain", key="xy_chain", n="18", family="Chain", title="XY-chain",
        what="A run of two-candidate cells, each seeing the next and sharing a digit with it, that begins and ends on the same digit.",
        why="""Suppose the first cell is not <b>Z</b>. Then it is its other digit; the next cell
             sees it and shares that digit, so it must be its own other digit; and so on down the
             chain. Follow it to the end and the last cell is forced to Z. So <b>either the first
             cell is Z or the last one is</b> &mdash; and anything seeing both ends loses Z.""",
        find="""Start from a bi-value cell and treat one of its digits as the one you are chasing.
             Step to a neighbour that shares the other digit, and keep stepping. Four links is a
             normal length; if you have not come back to your starting digit by six, start
             somewhere else.""",
        kill="The chased digit, from every cell seeing both ends of the chain.",
        guard="""Every cell in the chain must have <b>exactly two</b> candidates &mdash; a cell
             with three breaks the cascade, because being denied one digit no longer forces the
             other. And the chain has to come back to the digit it started on: ending on a
             different one proves nothing.""",
        cost="""The XY-Wing with more links, and the same scan. It is also the easiest chain to
             check afterwards, which makes it the right one to trust first."""),

    "aic": dict(
        id="aic", key="aic", n="19", family="Chain", title="AIC",
        what="A chain that alternates strong and weak links and begins and ends on a strong one.",
        why="""A <b>strong</b> link says at least one of these two is true; a <b>weak</b> link
             says at most one of these two is true. Alternate them, starting and ending strong,
             and the chain proves <b>at least one of its two ends is true</b>. That is the whole
             of it, and it is why the eight techniques above are variations rather than facts:
             each is an AIC of some particular shape. From the two ends: if both ends are the
             same digit, everything seeing both loses it; if they are different digits in cells
             that see each other, neither end can hold the other's digit; if they are two digits
             in one cell, every other candidate in that cell dies.""",
        find="""Not by sweeping &mdash; by starting somewhere interesting and walking. Take a
             candidate that sits in a strong link, follow the link, then leave the cell you land
             on by a weak link, and repeat. Keep the chain short enough to check: three links is
             a normal find, five is a long one.""",
        kill="Whatever the two ends allow, which is why the ends are the only part worth writing down.",
        guard="""The links must genuinely alternate, and the chain must both start and end on a
             strong link &mdash; a chain that ends weak proves nothing whatever it looks like. A
             strong link is a unit with <b>exactly two</b> spots for the digit, or a cell with
             exactly two candidates; anything looser is a weak link wearing a disguise.""",
        cost="""The general case, and the last thing to reach for. The trainer only searches for
             one when nothing cheaper exists on the board, because an AIC that duplicates a
             pointing pair is not information."""),
}
