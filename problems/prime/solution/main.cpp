#include <bits/stdc++.h>
using namespace std;
int main(){ios::sync_with_stdio(false);cin.tie(nullptr);int n;cin>>n;bool ok=n>=2;for(int i=2;i*i<=n;i++)if(n%i==0)ok=false;cout<<(ok?"Yes":"No");return 0;}
