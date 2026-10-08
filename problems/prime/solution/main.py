n=int(input());ok=n>=2
for i in range(2,int(n**0.5)+1):
 if n%i==0: ok=False
print("Yes" if ok else "No")
