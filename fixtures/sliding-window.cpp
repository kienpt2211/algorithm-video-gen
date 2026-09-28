#include <iostream>
#include <vector>
using namespace std;

int main() {
  int n, k;
  cin >> n >> k;
  vector<int> a(n);
  for (int &value : a) cin >> value;
  if (k <= 0 || k > n) return 0;

  int windowLeft = 0, windowRight = k - 1;
  int windowSum = 0;
  for (int i = 0; i < k; i++) {
    windowSum += a[i];
  }

  int bestSum = windowSum;
  int bestLeft = 0;
  for (int next = k; next < n; next++) {
    int outgoing = windowLeft;
    windowLeft++;
    windowRight = next;
    windowSum += a[windowRight];
    windowSum -= a[outgoing];
    if (windowSum > bestSum) {
      bestSum = windowSum;
      bestLeft = windowLeft;
    }
  }

  cout << bestLeft << ' ' << bestSum << '\n';
}
