import os, subprocess, sys

BASE = os.path.expanduser("~/Desktop/shoebox-new")

# Create all directories
dirs = ["app/login","app/dashboard","app/upload","app/auth/callback","components","lib","types","supabase"]
for d in dirs:
    os.makedirs(os.path.join(BASE, d), exist_ok=True)

print(f"Created directory structure at {BASE}")
print("Now run: python3 ~/Documents/concert-map/setup2.py")
