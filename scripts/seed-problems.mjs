import fs from "node:fs/promises";
import path from "node:path";
const defs = [];
const add = (
  id,
  title,
  difficulty,
  input,
  output,
  constraints,
  cases,
  py,
  cpp,
  java,
) =>
  defs.push({
    id,
    title,
    difficulty,
    input,
    output,
    constraints,
    cases,
    py,
    cpp,
    java,
  });
add(
  "even-or-odd",
  "Even or Odd",
  "very-easy",
  "One integer n.",
  "Print Even or Odd.",
  "-10^9 ≤ n ≤ 10^9.",
  [
    ["7", "Odd"],
    ["8", "Even"],
    ["0", "Even"],
    ["-3", "Odd"],
    ["-1000000000", "Even"],
    ["1000000000", "Even"],
  ],
  'n=int(input()); print("Even" if n%2==0 else "Odd")',
  'long long n; cin>>n; cout<<(n%2==0?"Even":"Odd");',
  'long n=sc.nextLong(); System.out.println(n%2==0?"Even":"Odd");',
);
add(
  "sum-of-two",
  "Sum of Two Numbers",
  "very-easy",
  "Two integers a and b.",
  "Print their sum.",
  "-10^9 ≤ a,b ≤ 10^9.",
  [
    ["2 3", "5"],
    ["0 0", "0"],
    ["-7 2", "-5"],
    ["1000000000 1000000000", "2000000000"],
    ["-1000000000 -1000000000", "-2000000000"],
  ],
  "a,b=map(int,input().split()); print(a+b)",
  "long long a,b; cin>>a>>b; cout<<a+b;",
  "long a=sc.nextLong(), b=sc.nextLong(); System.out.println(a+b);",
);
add(
  "maximum-of-two",
  "Maximum of Two Numbers",
  "very-easy",
  "Two integers a and b.",
  "Print the larger value.",
  "-10^9 ≤ a,b ≤ 10^9.",
  [
    ["3 8", "8"],
    ["9 2", "9"],
    ["-5 -2", "-2"],
    ["0 0", "0"],
    ["1000000000 -1000000000", "1000000000"],
  ],
  "print(max(map(int,input().split())))",
  "long long a,b; cin>>a>>b; cout<<max(a,b);",
  "System.out.println(Math.max(sc.nextLong(),sc.nextLong()));",
);
add(
  "maximum-of-three",
  "Maximum of Three Numbers",
  "very-easy",
  "Three integers.",
  "Print the largest value.",
  "Each integer is between -10^9 and 10^9.",
  [
    ["1 9 4", "9"],
    ["-3 -1 -8", "-1"],
    ["0 0 0", "0"],
    ["8 8 2", "8"],
    ["1000000000 0 -1000000000", "1000000000"],
  ],
  "print(max(map(int,input().split())))",
  "long long a,b,c; cin>>a>>b>>c; cout<<max({a,b,c});",
  "System.out.println(Math.max(sc.nextLong(),Math.max(sc.nextLong(),sc.nextLong())));",
);
add(
  "number-sign",
  "Positive, Negative, or Zero",
  "very-easy",
  "One integer n.",
  "Print Positive, Negative, or Zero.",
  "-10^9 ≤ n ≤ 10^9.",
  [
    ["5", "Positive"],
    ["-2", "Negative"],
    ["0", "Zero"],
    ["1000000000", "Positive"],
    ["-1000000000", "Negative"],
  ],
  'n=int(input()); print("Positive" if n>0 else "Negative" if n<0 else "Zero")',
  'long long n;cin>>n;cout<<(n>0?"Positive":n<0?"Negative":"Zero");',
  'long n=sc.nextLong();System.out.println(n>0?"Positive":n<0?"Negative":"Zero");',
);
const arrayInput =
  "The first line contains n. The second line contains n space-separated integers.";
const arrayConstraint = "1 ≤ n ≤ 100; each element is between -1000 and 1000.";
const arrayCases = [
  ["4\n1 2 3 4", "10"],
  ["1\n-5", "-5"],
  ["3\n0 0 0", "0"],
  ["4\n-3 2 -2 3", "0"],
  ["3\n1000 1000 1000", "3000"],
];
add(
  "sum-array",
  "Sum of Array Elements",
  "very-easy",
  arrayInput,
  "Print the sum of all elements.",
  arrayConstraint,
  arrayCases,
  "n=int(input()); a=list(map(int,input().split())); print(sum(a))",
  "int n,x;cin>>n;long long s=0;while(n--){cin>>x;s+=x;}cout<<s;",
  "int n=sc.nextInt();long s=0;while(n-->0)s+=sc.nextInt();System.out.println(s);",
);
for (const [id, title, condition, pyCondition, cases] of [
  [
    "count-even",
    "Count Even Numbers",
    "x%2==0",
    "x%2==0",
    [
      ["5\n1 2 3 4 6", "3"],
      ["1\n-2", "1"],
      ["3\n1 3 5", "0"],
      ["3\n0 -4 8", "3"],
      ["4\n-3 -2 -1 0", "2"],
    ],
  ],
  [
    "count-odd",
    "Count Odd Numbers",
    "x%2!=0",
    "x%2!=0",
    [
      ["4\n1 2 3 4", "2"],
      ["1\n-3", "1"],
      ["3\n0 2 4", "0"],
      ["3\n-1 -3 -5", "3"],
      ["4\n-3 -2 -1 0", "2"],
    ],
  ],
  [
    "count-positive",
    "Count Positive Numbers",
    "x>0",
    "x>0",
    [
      ["5\n-2 0 1 3 -4", "2"],
      ["1\n0", "0"],
      ["3\n-1 -2 -3", "0"],
      ["3\n1 2 3", "3"],
      ["4\n1000 -1000 0 1", "2"],
    ],
  ],
])
  add(
    id,
    title,
    "very-easy",
    arrayInput,
    `Print the number of ${id === "count-even" ? "even" : id === "count-odd" ? "odd" : "strictly positive"} elements.`,
    arrayConstraint,
    cases,
    `n=int(input());a=list(map(int,input().split()));print(sum(1 for x in a if ${pyCondition}))`,
    `int n,x,c=0;cin>>n;while(n--){cin>>x;if(${condition})c++;}cout<<c;`,
    `int n=sc.nextInt(),c=0;while(n-->0){int x=sc.nextInt();if(${condition})c++;}System.out.println(c);`,
  );
add(
  "reverse-string",
  "Reverse a String",
  "very-easy",
  "A single nonempty line of lowercase English letters.",
  "Print the string in reverse order.",
  "1 ≤ length ≤ 100.",
  [
    ["hello", "olleh"],
    ["a", "a"],
    ["race", "ecar"],
    ["aaaa", "aaaa"],
    ["abcdef", "fedcba"],
  ],
  "print(input()[::-1])",
  "string s;cin>>s;reverse(s.begin(),s.end());cout<<s;",
  "System.out.println(new StringBuilder(sc.next()).reverse());",
);
add(
  "count-vowels",
  "Count Vowels",
  "easy",
  "A nonempty string of lowercase English letters.",
  "Print how many letters are a, e, i, o, or u.",
  "1 ≤ length ≤ 100.",
  [
    ["hello", "2"],
    ["aeiou", "5"],
    ["rhythm", "0"],
    ["a", "1"],
    ["bcdf", "0"],
    ["education", "5"],
  ],
  'print(sum(c in "aeiou" for c in input()))',
  'string s;cin>>s;int n=0;for(char c:s)if(string("aeiou").find(c)!=string::npos)n++;cout<<n;',
  'String s=sc.next();int n=0;for(char c:s.toCharArray())if("aeiou".indexOf(c)>=0)n++;System.out.println(n);',
);
for (const [id, title, op, cases] of [
  [
    "minimum-array",
    "Find Minimum Element",
    "min",
    [
      ["4\n3 1 4 2", "1"],
      ["1\n7", "7"],
      ["3\n-5 -2 -9", "-9"],
      ["3\n0 0 0", "0"],
      ["3\n1000 -1000 4", "-1000"],
    ],
  ],
  [
    "maximum-array",
    "Find Maximum Element",
    "max",
    [
      ["4\n3 1 4 2", "4"],
      ["1\n-7", "-7"],
      ["3\n-5 -2 -9", "-2"],
      ["3\n0 0 0", "0"],
      ["3\n1000 -1000 4", "1000"],
    ],
  ],
])
  add(
    id,
    title,
    "very-easy",
    arrayInput,
    `Print the ${op === "min" ? "smallest" : "largest"} element.`,
    arrayConstraint,
    cases,
    `n=int(input());print(${op}(map(int,input().split())))`,
    `int n,x,b;cin>>n>>b;for(int i=1;i<n;i++){cin>>x;b=${op}(b,x);}cout<<b;`,
    `int n=sc.nextInt(),b=sc.nextInt();for(int i=1;i<n;i++)b=Math.${op}(b,sc.nextInt());System.out.println(b);`,
  );
add(
  "palindrome",
  "Check Palindrome",
  "easy",
  "A nonempty lowercase English string.",
  "Print Yes if it reads the same forwards and backwards; otherwise print No.",
  "1 ≤ length ≤ 100.",
  [
    ["racecar", "Yes"],
    ["hello", "No"],
    ["a", "Yes"],
    ["abba", "Yes"],
    ["ab", "No"],
    ["aaaa", "Yes"],
  ],
  's=input();print("Yes" if s==s[::-1] else "No")',
  'string s;cin>>s;string t=s;reverse(t.begin(),t.end());cout<<(s==t?"Yes":"No");',
  'String s=sc.next();System.out.println(s.equals(new StringBuilder(s).reverse().toString())?"Yes":"No");',
);
add(
  "sum-digits",
  "Sum of Digits",
  "easy",
  "One nonnegative integer n.",
  "Print the sum of its decimal digits.",
  "0 ≤ n ≤ 10^9.",
  [
    ["123", "6"],
    ["0", "0"],
    ["9", "9"],
    ["1000000000", "1"],
    ["999999999", "81"],
    ["10001", "2"],
  ],
  "print(sum(map(int,input().strip())))",
  "long long n;cin>>n;int s=0;while(n){s+=n%10;n/=10;}cout<<s;",
  "long n=sc.nextLong();int s=0;while(n>0){s+=n%10;n/=10;}System.out.println(s);",
);
add(
  "count-digits",
  "Count Digits",
  "very-easy",
  "One nonnegative integer without leading zeros.",
  "Print its number of decimal digits. Zero has one digit.",
  "0 ≤ n ≤ 10^9.",
  [
    ["123", "3"],
    ["0", "1"],
    ["9", "1"],
    ["1000000000", "10"],
    ["10001", "5"],
  ],
  "print(len(input().strip()))",
  "string s;cin>>s;cout<<s.size();",
  "System.out.println(sc.next().length());",
);
add(
  "factorial",
  "Factorial",
  "easy",
  "One integer n.",
  "Print n! (the product 1 × 2 × ... × n). Define 0! = 1.",
  "0 ≤ n ≤ 12.",
  [
    ["5", "120"],
    ["0", "1"],
    ["1", "1"],
    ["12", "479001600"],
    ["8", "40320"],
  ],
  "n=int(input());r=1\nfor i in range(1,n+1): r*=i\nprint(r)",
  "int n;cin>>n;long long r=1;for(int i=1;i<=n;i++)r*=i;cout<<r;",
  "int n=sc.nextInt();long r=1;for(int i=1;i<=n;i++)r*=i;System.out.println(r);",
);
add(
  "fibonacci",
  "Fibonacci Number",
  "easy",
  "One integer n.",
  "Print F(n), where F(0)=0, F(1)=1, and F(n)=F(n-1)+F(n-2).",
  "0 ≤ n ≤ 30.",
  [
    ["7", "13"],
    ["0", "0"],
    ["1", "1"],
    ["2", "1"],
    ["30", "832040"],
    ["10", "55"],
  ],
  "n=int(input());a,b=0,1\nfor _ in range(n): a,b=b,a+b\nprint(a)",
  "int n;cin>>n;int a=0,b=1;while(n--){int c=a+b;a=b;b=c;}cout<<a;",
  "int n=sc.nextInt(),a=0,b=1;while(n-->0){int c=a+b;a=b;b=c;}System.out.println(a);",
);
add(
  "celsius-fahrenheit",
  "Celsius to Fahrenheit",
  "very-easy",
  "An integer temperature c in Celsius, divisible by 5.",
  "Print the integer Fahrenheit temperature: c × 9 / 5 + 32.",
  "-100 ≤ c ≤ 100; c is divisible by 5.",
  [
    ["0", "32"],
    ["100", "212"],
    ["-40", "-40"],
    ["5", "41"],
    ["-100", "-148"],
  ],
  "c=int(input());print(c*9//5+32)",
  "int c;cin>>c;cout<<c*9/5+32;",
  "System.out.println(sc.nextInt()*9/5+32);",
);
add(
  "leap-year",
  "Check Leap Year",
  "easy",
  "One integer year.",
  "Print Yes for a leap year, otherwise No. A year is leap if divisible by 400, or divisible by 4 but not 100.",
  "1 ≤ year ≤ 9999.",
  [
    ["2024", "Yes"],
    ["2023", "No"],
    ["1900", "No"],
    ["2000", "Yes"],
    ["1", "No"],
    ["2400", "Yes"],
  ],
  'n=int(input());print("Yes" if n%400==0 or (n%4==0 and n%100!=0) else "No")',
  'int n;cin>>n;cout<<(n%400==0||(n%4==0&&n%100!=0)?"Yes":"No");',
  'int n=sc.nextInt();System.out.println(n%400==0||(n%4==0&&n%100!=0)?"Yes":"No");',
);
add(
  "square-number",
  "Square of a Number",
  "very-easy",
  "One integer n.",
  "Print n × n.",
  "-10000 ≤ n ≤ 10000.",
  [
    ["5", "25"],
    ["0", "0"],
    ["-3", "9"],
    ["10000", "100000000"],
    ["-10000", "100000000"],
  ],
  "n=int(input());print(n*n)",
  "long long n;cin>>n;cout<<n*n;",
  "long n=sc.nextLong();System.out.println(n*n);",
);
add(
  "average",
  "Find Average",
  "easy",
  arrayInput,
  "Print the arithmetic mean with exactly two digits after the decimal point.",
  arrayConstraint,
  [
    ["4\n1 2 3 4", "2.50"],
    ["1\n-5", "-5.00"],
    ["3\n0 0 0", "0.00"],
    ["3\n1 2 2", "1.67"],
    ["3\n-1 -2 -2", "-1.67"],
    ["2\n1000 -1000", "0.00"],
  ],
  'n=int(input());a=list(map(int,input().split()));print(f"{sum(a)/n:.2f}")',
  "int n;cin>>n;double s=0;for(int i=0,x;i<n;i++){cin>>x;s+=x;}cout<<fixed<<setprecision(2)<<s/n;",
  'int n=sc.nextInt();double s=0;for(int i=0;i<n;i++)s+=sc.nextInt();System.out.printf(Locale.US,"%.2f%n",s/n);',
);
add(
  "reverse-array",
  "Reverse an Array",
  "easy",
  arrayInput,
  "Print all elements in reverse order, separated by spaces.",
  arrayConstraint,
  [
    ["4\n1 2 3 4", "4 3 2 1"],
    ["1\n5", "5"],
    ["3\n-1 0 2", "2 0 -1"],
    ["3\n0 0 0", "0 0 0"],
    ["2\n1000 -1000", "-1000 1000"],
  ],
  'n=int(input());a=input().split();print(" ".join(a[::-1]))',
  'int n;cin>>n;vector<int>a(n);for(int &x:a)cin>>x;for(int i=n-1;i>=0;i--)cout<<a[i]<<(i?" ":"\\n");',
  'int n=sc.nextInt();int[] a=new int[n];for(int i=0;i<n;i++)a[i]=sc.nextInt();for(int i=n-1;i>=0;i--)System.out.print(a[i]+(i>0?" ":"\\n"));',
);
add(
  "prime",
  "Check Prime",
  "easy",
  "One integer n.",
  "Print Yes if n is prime (has exactly two positive divisors), otherwise No.",
  "0 ≤ n ≤ 100000.",
  [
    ["7", "Yes"],
    ["1", "No"],
    ["0", "No"],
    ["2", "Yes"],
    ["9", "No"],
    ["99991", "Yes"],
    ["100000", "No"],
  ],
  'n=int(input());ok=n>=2\nfor i in range(2,int(n**0.5)+1):\n if n%i==0: ok=False\nprint("Yes" if ok else "No")',
  'int n;cin>>n;bool ok=n>=2;for(int i=2;i*i<=n;i++)if(n%i==0)ok=false;cout<<(ok?"Yes":"No");',
  'int n=sc.nextInt();boolean ok=n>=2;for(int i=2;i*i<=n;i++)if(n%i==0)ok=false;System.out.println(ok?"Yes":"No");',
);
add(
  "second-largest",
  "Second Largest Distinct Value",
  "easy",
  arrayInput,
  "Print the second largest distinct value. Repeated copies of the maximum do not count.",
  "2 ≤ n ≤ 100; -1000 ≤ elements ≤ 1000; at least two distinct values.",
  [
    ["5\n1 5 3 5 2", "3"],
    ["2\n-1 -2", "-2"],
    ["4\n9 9 8 8", "8"],
    ["3\n-1000 0 1000", "0"],
    ["3\n-5 -5 -4", "-5"],
  ],
  "n=int(input());print(sorted(set(map(int,input().split())))[-2])",
  "int n,x;cin>>n;set<int>s;while(n--){cin>>x;s.insert(x);}auto it=s.rbegin();++it;cout<<*it;",
  "int n=sc.nextInt();TreeSet<Integer>s=new TreeSet<>();while(n-->0)s.add(sc.nextInt());s.pollLast();System.out.println(s.last());",
);
add(
  "string-length",
  "String Length",
  "very-easy",
  "A single nonempty lowercase English string.",
  "Print the number of characters in the string.",
  "1 ≤ length ≤ 100.",
  [
    ["race", "4"],
    ["a", "1"],
    ["hello", "5"],
    ["abcdefghij", "10"],
    ["aaaaaa", "6"],
  ],
  "print(len(input()))",
  "string s;cin>>s;cout<<s.size();",
  "System.out.println(sc.next().length());",
);
const starters = {
  cpp17:
    "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // Read input and write your solution here.\n    return 0;\n}\n",
  python3:
    'import sys\n\ndef main():\n    # Read input and write your solution here.\n    pass\n\nif __name__ == "__main__":\n    main()\n',
  java17:
    "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Read input and write your solution here.\n    }\n}\n",
};
for (const d of defs) {
  const dir = path.join("problems", d.id);
  for (const sub of ["starter", "solution", "tests"])
    await fs.mkdir(path.join(dir, sub), { recursive: true });
  await fs.writeFile(
    path.join(dir, "problem.json"),
    JSON.stringify(
      {
        id: d.id,
        title: d.title,
        difficulty: d.difficulty,
        estimatedMinutes: d.difficulty === "easy" ? 3 : 1,
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        enabled: true,
        tags: ["beginner"],
        samples: ["sample1"],
        supportedLanguages: ["cpp17", "python3", "java17"],
      },
      null,
      2,
    ) + "\n",
  );
  await fs.writeFile(
    path.join(dir, "statement.md"),
    `# ${d.title}\n\n${d.output}\n\n## Input\n\n${d.input}\n\n## Output\n\n${d.output}\n\n## Constraints\n\n${d.constraints}\n`,
  );
  const sources = {
    cpp17: `#include <bits/stdc++.h>\nusing namespace std;\nint main(){ios::sync_with_stdio(false);cin.tie(nullptr);${d.cpp}return 0;}\n`,
    python3: d.py + "\n",
    java17: `import java.util.*;\npublic class Main {public static void main(String[] args){Scanner sc=new Scanner(System.in);${d.java}}}\n`,
  };
  for (const [lang, file] of Object.entries({
    cpp17: "main.cpp",
    python3: "main.py",
    java17: "Main.java",
  })) {
    await fs.writeFile(path.join(dir, "starter", file), starters[lang]);
    await fs.writeFile(path.join(dir, "solution", file), sources[lang]);
  }
  for (let i = 0; i < d.cases.length; i++) {
    const name = i === 0 ? "sample1" : `test${String(i).padStart(2, "0")}`;
    await fs.writeFile(
      path.join(dir, "tests", name + ".in"),
      d.cases[i][0] + "\n",
    );
    await fs.writeFile(
      path.join(dir, "tests", name + ".out"),
      d.cases[i][1] + "\n",
    );
  }
}
console.log(
  `Created ${defs.length} problem folders. Run problems:validate with the Docker judge before live matches.`,
);
