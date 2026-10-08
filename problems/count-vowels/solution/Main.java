import java.util.*;
public class Main {public static void main(String[] args){Scanner sc=new Scanner(System.in);String s=sc.next();int n=0;for(char c:s.toCharArray())if("aeiou".indexOf(c)>=0)n++;System.out.println(n);}}
