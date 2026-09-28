#include <iostream>
#include <vector>
using namespace std;

int main() {
  int n, target;
  cin >> n >> target;
  vector<int> a(n);
  for (int &value : a) cin >> value;
  int left = 0, right = n - 1, answer = -1;
  while (left <= right) {
    int mid = left + (right - left) / 2;
    if (a[mid] == target) {
      answer = mid;
      break;
    }
    if (a[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  cout << answer << '\n';
}
