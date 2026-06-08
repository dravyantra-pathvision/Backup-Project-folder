from PIL import Image
import sys

if len(sys.argv) != 3:
    print('Usage: generate_windows_icon.py <input_jpeg> <output_ico>')
    sys.exit(2)

input_path = sys.argv[1]
output_path = sys.argv[2]

sizes = [(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)]

img = Image.open(input_path).convert('RGBA')

icons = []
for size in sizes:
    icon = img.copy().resize(size, Image.LANCZOS)
    icons.append(icon)

icons[0].save(output_path, format='ICO', sizes=[(s[0], s[1]) for s in sizes])
print('Wrote', output_path)
