#include <bits/stdc++.h>
using namespace std;
int main(){ios::sync_with_stdio(false);cin.tie(nullptr);int n,x;cin>>n;set<int>s;while(n--){cin>>x;s.insert(x);}auto it=s.rbegin();++it;cout<<*it;return 0;}
