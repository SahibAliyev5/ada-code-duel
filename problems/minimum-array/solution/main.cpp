#include <bits/stdc++.h>
using namespace std;
int main(){ios::sync_with_stdio(false);cin.tie(nullptr);int n,x,b;cin>>n>>b;for(int i=1;i<n;i++){cin>>x;b=min(b,x);}cout<<b;return 0;}
