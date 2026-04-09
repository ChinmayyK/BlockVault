with open('index.html', 'r') as f:
    content = f.read()

fonts = """    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">"""

import re
content = re.sub(r'    <link rel="preconnect" href="https://fonts.googleapis.com">.*?<link href="https://fonts.googleapis.com/css2\?family=Inter.*?rel="stylesheet">', fonts, content, flags=re.DOTALL)

with open('index.html', 'w') as f:
    f.write(content)
