#include <bits/stdc++.h>
using namespace std;
int main(){ios::sync_with_stdio(false);cin.tie(nullptr);long long n;cin>>n;int s=0;while(n){s+=n%10;n/=10;}cout<<s;return 0;}
