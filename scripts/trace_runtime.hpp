#pragma once
#include <array>
#include <deque>
#include <fstream>
#include <iomanip>
#include <map>
#include <queue>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>
namespace algorithm_trace {
inline std::string escape(const std::string& value) { std::ostringstream out; for (unsigned char c : value) { if (c == '"' || c == '\\') out << '\\' << c; else if (c == '\n') out << "\\n"; else if (c == '\r') out << "\\r"; else if (c == '\t') out << "\\t"; else if (c < 32) out << "?"; else out << c; } return out.str(); }
inline std::string json(const std::string& value) { return "\"" + escape(value) + "\""; }
inline std::string json(const char* value) { return json(std::string(value)); }
inline std::string json(char value) { return json(std::string(1, value)); }
inline std::string json(bool value) { return value ? "true" : "false"; }
template <typename T, std::enable_if_t<std::is_arithmetic_v<T> && !std::is_same_v<T, bool> && !std::is_same_v<T, char>, int> = 0> std::string json(T value) { std::ostringstream out; out << std::setprecision(15) << value; return out.str(); }
template <typename A, typename B> std::string json(const std::pair<A, B>& value) { return "[" + json(value.first) + "," + json(value.second) + "]"; }
template <typename T> std::string json(const std::vector<T>& value);
template <typename T> std::string json(const std::deque<T>& value);
template <typename It> std::string range_json(It begin, It end) { std::string out = "["; bool first = true; for (; begin != end; ++begin) { if (!first) out += ","; first = false; out += json(*begin); } return out + "]"; }
template <typename T> std::string json(const std::vector<T>& value) { return range_json(value.begin(), value.end()); }
template <typename T> std::string json(const std::deque<T>& value) { return range_json(value.begin(), value.end()); }
template <typename T, size_t N> std::string json(const std::array<T, N>& value) { return range_json(value.begin(), value.end()); }
template <typename T, size_t N> std::string json(const T (&value)[N]) { return range_json(value, value + N); }
template <typename T> std::string json(const std::set<T>& value) { return range_json(value.begin(), value.end()); }
template <typename K, typename V> std::string json(const std::map<K, V>& value) { std::string out = "{"; bool first = true; for (const auto& item : value) { if (!first) out += ","; first = false; std::ostringstream key; key << item.first; out += json(key.str()) + ":" + json(item.second); } return out + "}"; }
template <typename T> std::string json(std::stack<T> value) { std::vector<T> items; while (!value.empty()) { items.push_back(value.top()); value.pop(); } return json(items); }
template <typename T> std::string json(std::queue<T> value) { std::vector<T> items; while (!value.empty()) { items.push_back(value.front()); value.pop(); } return json(items); }
struct Named { std::string name; std::string value; };
template <typename T> Named named(const char* name, const T& value) { return {name, json(value)}; }
template <typename... Values> void emit(int line, const char* function_name, Values... values) { static std::ofstream output("trace.raw.jsonl", std::ios::app); output << "{\"line\":" << line << ",\"function\":" << json(function_name) << ",\"variables\":{"; bool first = true; const std::array<Named, sizeof...(Values)> items = {values...}; for (const Named& item : items) { if (!first) output << ','; first = false; output << json(item.name) << ':' << item.value; } output << "}}\n"; output.flush(); }
}
