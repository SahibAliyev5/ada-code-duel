#include <bits/stdc++.h>
using namespace std;
int main(){ios::sync_with_stdio(false);cin.tie(nullptr);string s;cin>>s;int n=0;for(char c:s)if(string("aeiou").find(c)!=string::npos)n++;cout<<n;return 0;}
