from setuptools import setup, find_packages

setup(
    name="research-tree-backend",
    version="0.1.0",
    python_requires=">=3.10",
    packages=find_packages(include=["app*"]),
)
