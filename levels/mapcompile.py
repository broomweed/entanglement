import tmxlib
import sys

if len(sys.argv) < 2:
    print("usage:", sys.argv[0], "<infiles>")
    sys.exit(1)

screenwidth, screenheight = 10, 7

tilemapping = { 0: 0, 1: 3, 2: 2, 3: 7, 4: 8 }

print("var levels=[")
for filename in sys.argv[1:]:
    m = tmxlib.Map.open(filename)

    print('\t[', end='')
    for y in range(screenheight):
        for x in range(screenwidth):
            thing = m.layers['Tile Layer 1'][x, y].gid - 1
            print(tilemapping[thing], end='')
            print(',', end='')
    print('],')
print("]")
