import java.util.*;
public class Main {public static void main(String[] args){Scanner sc=new Scanner(System.in);int n=sc.nextInt();TreeSet<Integer>s=new TreeSet<>();while(n-->0)s.add(sc.nextInt());s.pollLast();System.out.println(s.last());}}
